import { readPublicCatalogue, MODEL_REGISTRY_ORIGIN } from './public';

export interface PublicVariant { id: string; quant: string; format: string; bytes: number; file: string; readiness: string; }
export interface PublicModel { id: string; family: string; familyId: string; name: string; provider: string; repo: string; description: string;
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
      const selector = object(model.package_selector) ? model.package_selector : undefined;
      const selectedQuants = selector?.allowed_quants;
      if (selectedQuants !== undefined && (!Array.isArray(selectedQuants) || selectedQuants.length > 128 || !selectedQuants.every(q => typeof q === 'string'))) throw new Error('Invalid saved quant selection');
      if (new Set(variants.map(v => object(v) ? v.id : null)).size !== variants.length) throw new Error('Duplicate model variant ids');
      models.push({ id: text(model.id), family: text(family.name), familyId: text(family.id), name: text(model.name), provider: text(family.provider),
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
        }).filter(variant => Array.isArray(selectedQuants) ? selectedQuants.includes(variant.quant) :
          typeof selector?.primary_file === 'string' && selector.primary_file === variant.file) });
      if (models.length > 4096) throw new Error('Model catalogue exceeds the supported size');
    }
  }
  if (new Set(models.map(model => model.id)).size !== models.length) throw new Error('Duplicate model ids in catalogue');
  return models;
}

/** A package file's name without folder, extension or shard suffix ('Qwen3.5-4B-UD-Q4_K_XL') */
const fileStem = (file: string) => file.slice(file.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '').replace(/-\d{5}-of-\d{5}$/i, '');
/** How the Engine compares a tag with file names: case and '-'/'_' ignored */
const loose = (value: string) => value.toUpperCase().replace(/[-_]/g, '');

/**
 * The tag that names exactly this package's file: its file name past the part all the model's packages share
 * ('UD-Q4_K_XL', where the catalogue's quantization is 'Q4_K'). The Engine takes the first file containing the tag,
 * so a tag another package's file also contains is not used; the whole file name is tried next.
 */
const stemOf = (item: PublicVariant) => fileStem(item.file ?? '');
/**
 * A file named after another package plus a prefix ('mtp-…') is that package's companion: the Engine bundles it
 * with that package and never picks it for a tag, so it is not a package to choose.
 */
export const isCompanion = (model: PublicModel, item: PublicVariant) => model.variants.some(other => {
  const stem = loose(stemOf(other)), name = loose(stemOf(item));
  return stem && stem !== name && name.endsWith(stem);
});

export function variantTag(model: PublicModel, variant: PublicVariant): string {
  const companion = (item: PublicVariant) => isCompanion(model, item);
  if (companion(variant)) throw new Error('This file accompanies another package; download that package instead');
  const own = stemOf(variant), packages = model.variants.filter(item => !companion(item));
  const others = packages.filter(item => item !== variant), stems = packages.map(stemOf);
  let shared = 0;
  while (shared < own.length && stems.every(stem => stem[shared] === own[shared])) shared++;
  const start = Math.max(0, ...['-', '_', '.'].map(mark => own.lastIndexOf(mark, shared) + 1));
  const unique = (tag: string) => /^[A-Za-z0-9_.+-]+$/.test(tag) && !others.some(other =>
    loose(other.quant) === loose(tag) || loose(stemOf(other)).includes(loose(tag)));
  const tag = [shared < own.length ? own.slice(start) : '', variant.quant, own].find(item => item && item.toUpperCase() !== 'UNKNOWN' && unique(item));
  if (!tag) throw new Error('Multiple packages match this quantization; the downloader cannot tell their files apart');
  return tag;
}

/**
 * The Hugging Face reference the Engine downloads, as `cluaiz pull <owner>/<repo>:<tag>` does: the catalogue
 * already gave the repository, so nothing is resolved again.
 */
export function modelInstallReference(model: PublicModel, variant: PublicVariant): string {
  if (!model.variants.includes(variant) || !/^[\w.-]+$/.test(model.id) || variant.quant.toUpperCase() === 'UNKNOWN') {
    throw new Error('This package has no unambiguous install reference');
  }
  if (variant.readiness === 'incomplete') throw new Error('This package is missing required files');
  if (!/^[\w.-]+\/[\w.-]+$/.test(model.repo) || model.repo.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('This package has no valid Hugging Face repository reference');
  }
  return `${model.repo}:${variantTag(model, variant)}`;
}

export const modelCatalogue = { list: (refresh = false) =>
  readPublicCatalogue(`${MODEL_REGISTRY_ORIGIN}/api/v1/registry/models`, parseModels, refresh) };

/** A model's README from the registry (cluaiz.com), as Markdown */
export const modelReadme = (model: PublicModel, refresh = false) => readPublicCatalogue(
  `${MODEL_REGISTRY_ORIGIN}/api/v1/registry/models/readme?${new URLSearchParams({ family: model.familyId, model: model.id })}`,
  value => { if (!object(value)) throw new Error('Invalid model README'); return text(value.readme) ? String(value.readme).slice(0, 512 * 1024) : ''; },
  refresh);
