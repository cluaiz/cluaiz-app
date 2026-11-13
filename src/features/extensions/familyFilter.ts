import { Boxes, FileBox, HardDrive } from 'lucide-react';
import type { PublicModel } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import type { MultiLevelCategory } from '../../components/ui/dropdown';
import { isModelInstalled } from './catalogueView';
import { KIND_LABELS } from './cloudModelView';
import { setToolkitParams, toolkitParam } from './toolkitNavigation';
import { useToolkitUrl } from './useToolkitUrl';

/** The catalogue's tasks (Hugging Face pipeline tags) behind each model type, in menu order */
const TYPE_TASKS: Record<string, RegExp> = {
  chat: /^(text-generation|text2text-generation|text-to-text|conversational|image-text-to-text)$/,
  vision: /^(image|video)-/,
  embedding: /^(feature-extraction|sentence-similarity)$/,
  tts: /^text-to-(speech|audio)$/,
  stt: /^automatic-speech-recognition$/,
};
const TYPE_LABELS: Record<string, string> = { ...KIND_LABELS, vision: 'Vision' };

export const modelTypes = (model: PublicModel) =>
  Object.keys(TYPE_TASKS).filter(type => model.tasks.some(task => TYPE_TASKS[type].test(task.toLowerCase())));
const formatsOf = (model: PublicModel) => model.variants.map(variant => variant.format);

/**
 * A family page's filter, kept in the URL (type, format, show=installed). Only the types and package
 * formats its models have are offered.
 */
export function useFamilyFilter(models: PublicModel[], installed: ModelRegistryEntry[]) {
  useToolkitUrl();
  const type = toolkitParam('type'), format = toolkitParam('format'), installedOnly = toolkitParam('show') === 'installed';
  const types = Object.keys(TYPE_TASKS).filter(item => models.some(model => modelTypes(model).includes(item)));
  const formats = [...new Set(models.flatMap(formatsOf))].sort();
  const categories: MultiLevelCategory[] = [
    ...(types.length ? [{ id: 'type', label: 'Model Type', icon: Boxes, selectedValue: type, onSelect: (value: string) => setToolkitParams({ type: value }),
      options: [{ value: '', label: 'All Types' }, ...types.map(value => ({ value, label: TYPE_LABELS[value] }))] }] : []),
    ...(formats.length ? [{ id: 'format', label: 'Format', icon: FileBox, selectedValue: format, onSelect: (value: string) => setToolkitParams({ format: value }),
      options: [{ value: '', label: 'All Formats' }, ...formats.map(value => ({ value, label: value.toUpperCase() }))] }] : []),
    { id: 'show', label: 'Show', icon: HardDrive, selectedValue: installedOnly ? 'installed' : '',
      onSelect: value => setToolkitParams({ show: value }),
      options: [{ value: '', label: 'All models' }, { value: 'installed', label: 'Installed only' }] },
  ];
  const chips = [
    ...(type ? [{ key: 'type', label: TYPE_LABELS[type] ?? type, remove: () => setToolkitParams({ type: null }) }] : []),
    ...(format ? [{ key: 'format', label: format.toUpperCase(), remove: () => setToolkitParams({ format: null }) }] : []),
    ...(installedOnly ? [{ key: 'show', label: 'Installed only', remove: () => setToolkitParams({ show: null }) }] : []),
  ];
  return {
    categories, chips,
    clear: () => setToolkitParams({ type: null, format: null, show: null }),
    matches: (model: PublicModel) => (!type || modelTypes(model).includes(type)) && (!format || formatsOf(model).includes(format))
      && (!installedOnly || isModelInstalled(installed, model)),
  };
}
