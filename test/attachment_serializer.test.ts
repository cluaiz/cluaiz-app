import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeStagedAttachments } from '../src/features/chat/utils/attachmentSerializer.ts';
import type { StagedAttachment } from '../src/features/chat/components/AttachmentStagingDeck.tsx';

// Only the browser file transport is replaced. Actual Blob bytes and serializer run.
class BrowserFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    async readAsDataURL(blob: Blob) {
        try {
            this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
            this.onload?.();
        } catch (error) { this.onerror?.(error); }
    }
}
Object.defineProperty(globalThis, 'FileReader', {value: BrowserFileReader, configurable: true});

function attachment(name: string, type: string, content: string): StagedAttachment {
    const file = new File([content], name, {type});
    return {id:name, name, type, size:file.size, file} as StagedAttachment;
}

test('video upload sends the engine video contract without an unsupported fps field', async () => {
    const result = await serializeStagedAttachments([attachment('clip.webm', 'video/webm', 'video bytes')], 'Describe');
    assert.deepEqual(result.parts, [
        {type:'video_url',video_url:{url:'data:video/webm;base64,dmlkZW8gYnl0ZXM='}},
        {type:'text',text:'Describe'},
    ]);
    assert.equal(result.hasMultimodal, true);
});

test('audio uploads preserve their real MIME and bytes instead of being relabelled WAV', async () => {
    for (const type of ['audio/ogg', 'audio/webm', 'audio/flac', 'audio/mpeg', 'audio/wav']) {
        const result = await serializeStagedAttachments([attachment('recording', type, 'audio bytes')], '');
        assert.deepEqual(result.parts, [{type:'audio_url',audio_url:{url:`data:${type};base64,YXVkaW8gYnl0ZXM=`}}]);
        assert.equal(result.attachmentsMeta[0].type, type);
    }
});

test('source code, PDF, image and pasted text retain their existing transport and order', async () => {
    const snippets = {id:'paste',name:'snippet',isPastedText:true,pastedContent:'const value = 7;'} as StagedAttachment;
    const result = await serializeStagedAttachments([
        attachment('view.tsx', 'text/plain', 'source code'),
        attachment('report.pdf', 'application/pdf', 'document bytes'),
        attachment('photo.png', 'image/png', 'image bytes'), snippets,
    ], '  Explain  ');
    assert.deepEqual(result.parts.slice(0, 3).map(part => part.type), ['file_url','file_url','image_url']);
    assert.deepEqual(result.parts[0], {type:'file_url',file_url:{url:'data:text/plain;base64,c291cmNlIGNvZGU=',name:'view.tsx',detail:'full'}});
    assert.match((result.parts[3] as {text:string}).text, /const value = 7;/);
    assert.deepEqual(result.parts[4], {type:'text',text:'Explain'});
});
