import { readPublicCatalogue } from './public';

export interface PublicVariant { id: string; quant: string; format: string; bytes: number; file: string; readiness: string; }
export interface PublicModel { id: string; family: string; name: string; provider: string; repo: string; description: string;
  tasks: string[]; support: string; note: string; variants: PublicVariant[];
  logo: string; familyDescription: string; architecture: string; parameters: string; context: string; created: string; downloads: number | null; }
const text = (value: unknown): string => typeof value === 'string' ? value.slice(0, 4096) : '';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function parseModels(value: unknown): PublicModel[] {
  if (!Array.isArray(value) || value.length > 256) throw new Error('Invalid model families catalogue');
  const models: PublicModel[] = [];
  for (const family of value) {
    if (!object(family) || !Array.isArray(family.models) || family.models.length > 512) throw new Error('Invalid model family');
    for (const model of family.models) {
      if (!object(model) || !text(model.id) || !/^[\w.-]+\/[\w.-]+$/.test(text(model.hf_repo))) throw new Error('Invalid model identity');
      const variants = model.package_variants ?? [];
      if (!Array.isArray(variants) || variants.length > 1024) throw new Error('Invalid model variants');
      if (new Set(variants.map(v => object(v) ? v.id : null)).size !== variants.length) throw new Error('Duplicate model variant ids');
      models.push({ id: text(model.id), family: text(family.name), name: text(model.name), provider: text(family.provider),
        logo: text(family.logo), familyDescription: text(family.description), architecture: text(model.architecture) || text(family.architecture),
        parameters: text(model.parameters), context: text(model.context_window), created: text(model.created_at) || text(family.created_at),
        downloads: typeof model.downloads === 'number' && Number.isFinite(model.downloads) && model.downloads >= 0 ? model.downloads : null,
        repo: text(model.hf_repo), description: text(model.description), support: text(model.runtime_status) || 'unknown', note: text(model.support_note),
        tasks: Array.isArray(model.task) ? model.task.filter((t): t is string => typeof t === 'string').slice(0, 64) : [],
        variants: variants.map(v => {
          if (!object(v) || !text(v.id) || !text(v.quantTag) || !['gguf', 'onnx'].includes(String(v.format))
            || !Number.isSafeInteger(v.sizeBytes) || Number(v.sizeBytes) < 0 || !text(v.primaryFile)) throw new Error('Invalid model package');
          return { id: text(v.id), quant: text(v.quantTag), format: text(v.format), bytes: Number(v.sizeBytes),
            file: text(v.primaryFile), readiness: text(v.packageStatus) };
        }) });
      if (models.length > 4096) throw new Error('Model catalogue exceeds the supported size');
    }
  }
  if (new Set(models.map(model => model.id)).size !== models.length) throw new Error('Duplicate model ids in catalogue');
  return models;
}

export type ModelInstallSource = 'catalogue' | 'huggingface';
/** The current downloader accepts only a reference, not a file/format selector. */
export function modelInstallReference(model: PublicModel, variant: PublicVariant, source: ModelInstallSource = 'catalogue'): string {
  if (!model.variants.includes(variant) || !/^[\w.-]+$/.test(model.id) || !/^[A-Za-z0-9_.+-]+$/.test(variant.quant)
    || variant.quant.toUpperCase() === 'UNKNOWN') throw new Error('This package has no unambiguous install reference');
  if (variant.readiness === 'incomplete') throw new Error('This package is missing required files');
  if (model.variants.filter(v => v.quant.toLowerCase() === variant.quant.toLowerCase()).length !== 1) {
    throw new Error('Multiple packages share this quantization; the current downloader cannot select an exact file here');
  }
  if (source === 'huggingface') {
    if (!/^[\w.-]+\/[\w.-]+$/.test(model.repo) || model.repo.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('This package has no valid Hugging Face repository reference');
    }
    return `${model.repo}:${variant.quant}`;
  }
  return `${model.id}:${variant.quant}`;
}

export const modelCatalogue = { list: (refresh = false) =>
  readPublicCatalogue('https://cluaiz.com/api/v1/registry/models', parseModels, refresh) };
