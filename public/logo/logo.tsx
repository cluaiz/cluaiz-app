import { useEffect, useRef } from 'react';
import logo from './logo-bg-black.png';

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
#define PI 3.14159265359
#define TAU 6.28318530718
#define MATERIAL_OUTSIDE true
#define MATERIAL_REACH 0.3200
uniform sampler2D uField;
uniform sampler2D uSurf;
uniform vec2 uFieldScale;
uniform vec2 uResolution;
uniform float uTime;
uniform vec4 uMatP[8];
uniform vec4 uMatC[16];
uniform vec4 uSurface;
out vec4 outColor;
#define C_colorA uMatC[0]
#define C_colorB uMatC[1]
#define P_palette uMatP[0].x
#define P_size uMatP[0].y
#define P_height uMatP[0].z
#define P_bevel uMatP[0].w
#define P_tilt uMatP[1].x
#define P_lightAngle uMatP[1].y
#define P_shadows uMatP[1].z
#define P_seams uMatP[1].w
#define P_jitter uMatP[2].x
#define P_gloss uMatP[2].y

struct Surface {
  vec2 p;
  vec2 uv;
  vec2 frag;
  vec2 res;
  float unit;
  float px;
  float d;
  float aa;
  float cov;
  vec2 n;
  float slope;
  float time;
};

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

vec4 over(vec4 base, vec4 top) {
  return top + base * (1.0 - top.a);
}

vec3 toLinear(vec3 c) {
  return pow(c, vec3(2.2));
}

vec3 toDisplay(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

float shapeAt(vec2 q) {
  return texture(uField, q * uFieldScale + 0.5).r;
}

vec4 backdropAt(vec2 q) {
  return vec4(0.0);
}

float surfaceRim(Surface s, float width) {
  return clamp(1.0 + s.d / max(width, 1e-4), 0.0, 1.0);
}

vec3 domeNormal(Surface s, float width) {
  float x = min(surfaceRim(s, width), 0.985) * smoothstep(0.15, 0.85, s.slope);
  return normalize(vec3(s.n * x, sqrt(1.0 - x * x)));
}

float domeHeight(Surface s, float width) {
  float x = surfaceRim(s, width);
  return sqrt(max(1.0 - x * x, 0.0));
}


uint m_hash(uvec3 v) {
  uint h = v.x * 0x8da6b343u ^ v.y * 0xd8163841u ^ v.z * 0xcb1ab31fu;
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return h;
}

vec3 m_toLab(vec3 c) {
  vec3 lms = vec3(
    dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005))
  );
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return vec3(
    dot(lms, vec3(0.2104542553, 0.793617785, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.428592205, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.808675766))
  );
}

vec3 m_fromLab(vec3 l) {
  vec3 lms = vec3(
    l.x + 0.3963377774 * l.y + 0.2158037573 * l.z,
    l.x - 0.1055613458 * l.y - 0.0638541728 * l.z,
    l.x - 0.0894841775 * l.y - 1.291485548 * l.z
  );
  lms = lms * lms * lms;
  return vec3(
    dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
    dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
    dot(lms, vec3(-0.0041960863, -0.7034186147, 1.707614701))
  );
}

float m_column(vec2 cell, float v, float layers, float width) {
  float d = shapeAt(cell * v);
  if (d > -0.02 * v) return 0.0;
  float x = clamp(-d / width, 0.0, 1.0);
  float dome = sqrt(max(1.0 - (1.0 - x) * (1.0 - x), 0.0));
  return (floor(layers * dome + 0.5) + 1.0) * v;
}

struct m_Hit {
  float z;
  float axis;
  float prev;
  float h;
  vec2 cell;
  vec2 stp;
};

m_Hit m_trace(vec2 p, vec2 e, float top, float v, float layers, float width) {
  vec2 a = (p + e * top) / v + 0.5;
  vec2 dir = p / v + 0.5 - a;
  vec2 cell = floor(a);
  vec2 stp = vec2(dir.x < 0.0 ? -1.0 : 1.0, dir.y < 0.0 ? -1.0 : 1.0);
  vec2 inv = 1.0 / max(abs(dir), vec2(1e-6));
  vec2 tMax = vec2(
    (stp.x > 0.0 ? cell.x + 1.0 - a.x : a.x - cell.x) * inv.x,
    (stp.y > 0.0 ? cell.y + 1.0 - a.y : a.y - cell.y) * inv.y
  );
  float sIn = 0.0;
  float axis = -1.0;
  float prev = 0.0;
  m_Hit hit = m_Hit(-1.0, -1.0, 0.0, 0.0, cell, stp);
  for (int i = 0; i < 24; i++) {
    float sOut = min(min(tMax.x, tMax.y), 1.0);
    float h = m_column(cell, v, layers, width);
    float zIn = top * (1.0 - sIn);
    if (h > 0.0 && h >= top * (1.0 - sOut)) {
      bool side = h >= zIn;
      hit = m_Hit(side ? zIn : h, side ? axis : -1.0, prev, h, cell, stp);
      break;
    }
    if (sOut >= 1.0) break;
    prev = h;
    if (tMax.x < tMax.y) {
      cell.x += stp.x;
      sIn = tMax.x;
      tMax.x += inv.x;
      axis = 0.0;
    } else {
      cell.y += stp.y;
      sIn = tMax.y;
      tMax.y += inv.y;
      axis = 1.0;
    }
  }
  return hit;
}

vec3 m_shade(m_Hit hit, vec2 p, vec2 e, float v, float layers, float width, float px) {
  vec2 hp = p + e * hit.z;
  vec2 cc = hit.cell * v;
  float half_ = v * 0.5;
  float level = hit.axis < 0.0 ? hit.h / v - 1.0 : floor(hit.z / v - 1e-4);
  vec3 l = vec3(hp - cc, hit.z - (level + 0.5) * v);
  vec3 faceN = hit.axis < 0.0 ? vec3(0.0, 0.0, 1.0) : (hit.axis < 0.5 ? vec3(-hit.stp.x, 0.0, 0.0) : vec3(0.0, -hit.stp.y, 0.0));
  vec3 tangent = 1.0 - abs(faceN);
  vec3 al = abs(l) * tangent;
  float edge = clamp(max(max(al.x, al.y), al.z) / half_, 0.0, 1.0);
  float rEff = max(half_ * 0.12, px * 0.9);
  vec3 n = normalize(faceN * rEff + sign(l) * max(abs(l) - (half_ - rEff), 0.0) * tangent);

  float az = radians(P_lightAngle);
  float el = radians(42.0);
  vec3 L = normalize(vec3(cos(az) * cos(el), sin(az) * cos(el), sin(el)));
  vec3 V = normalize(vec3(e, 1.0));

  float shadow = 1.0;
  if (P_shadows > 0.001 && dot(n, L) > -0.12) {
    shadow = 0.0;
    vec2 ld = normalize(vec2(cos(az), sin(az)));
    float rise = tan(el);
    for (int k = 1; k <= 3; k++) {
      float dist = float(k) * 0.75 * v;
      vec2 pk = hp + ld * dist + faceN.xy * v * 0.05;
      float hk = m_column(floor(pk / v + 0.5), v, layers, width);
      shadow = max(shadow, smoothstep(0.0, v * 0.35, hk - (hit.z + dist * rise)));
    }
  }

  uint hsh = m_hash(uvec3(uvec2(ivec2(hit.cell + 4096.0)), uint(level + 1.0)));
  float rnd = float(hsh & 65535u) / 65535.0;
  vec3 ca = toLinear(C_colorA.rgb);
  vec3 cb = toLinear(C_colorB.rgb);
  float pt = 0.0;
  if (P_palette > 0.5 && P_palette < 1.5) pt = clamp(0.5 + cc.y / 1.8, 0.0, 1.0);
  if (P_palette > 1.5 && P_palette < 2.5) pt = 1.0 - (level + 0.5) / (layers + 1.0);
  if (P_palette > 2.5 && P_palette < 3.5) pt = rnd;
  if (P_palette > 3.5) pt = 1.0 - smoothstep(0.35, 0.75, n.z);
  vec3 base = P_palette < 0.5 ? ca : m_fromLab(mix(m_toLab(ca), m_toLab(cb), pt));
  vec3 albedo = base * (1.0 + (rnd - 0.5) * P_jitter * 0.6);

  float ao = hit.axis >= 0.0 ? mix(0.55, 1.0, smoothstep(0.0, v * 0.8, hit.z - hit.prev)) : 1.0;
  float ndl = clamp((dot(n, L) + 0.12) / 1.12, 0.0, 1.0);
  float lit = 1.0 - shadow * P_shadows;
  vec3 key = vec3(1.0, 0.89, 0.74) * 1.1;
  vec3 sky = vec3(0.35, 0.45, 0.68);
  vec3 ambient = mix(sky * 0.35, sky, clamp(-n.y, 0.0, 1.0)) * 0.55 * ao;
  float shin = exp2(mix(3.0, 7.5, P_gloss));
  float lobe = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), shin) * mix(0.2, 1.4, P_gloss);
  float rim = 0.02 + pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0) * P_gloss * 0.5;
  float sw = 0.04 + P_seams * 0.12;
  float fw = px / half_;
  float seam = smoothstep(1.0 - sw - fw, 1.0 - sw + fw, edge) * sw / max(sw, fw);
  vec3 rgb = albedo * (key * ndl * lit + ambient) + key * lobe * 0.6 * lit + sky * rim * 0.3 * ao;
  return rgb * (1.0 - P_seams * 0.75 * seam);
}

vec4 material(Surface s) {
  float v = P_size;
  float layers = clamp(floor(P_height / v + 0.5), 0.0, 16.0);
  float width = max(P_bevel, v);
  float top = (layers + 1.0) * v + 1e-4;
  vec2 e = vec2(0.70710678) * P_tilt;
  if (s.d > top * P_tilt + v) return vec4(0.0);
  vec2 off = vec2(0.25, -0.25) * s.px;
  m_Hit h1 = m_trace(s.p + off, e, top, v, layers, width);
  m_Hit h2 = m_trace(s.p - off, e, top, v, layers, width);
  float w1 = h1.z >= 0.0 ? 1.0 : 0.0;
  float w2 = h2.z >= 0.0 ? 1.0 : 0.0;
  if (w1 + w2 < 0.5) return vec4(0.0);
  vec3 c1 = w1 > 0.5 ? m_shade(h1, s.p + off, e, v, layers, width, s.px) : vec3(0.0);
  bool same = w1 > 0.5 && h1.axis == h2.axis && all(equal(h1.cell, h2.cell)) && abs(h1.z - h2.z) < v * 0.5;
  vec3 c2 = w2 > 0.5 ? (same ? c1 : m_shade(h2, s.p - off, e, v, layers, width, s.px)) : vec3(0.0);
  vec3 rgb = (c1 * w1 + c2 * w2) / (w1 + w2);
  return vec4(toDisplay(clamp(rgb, 0.0, 1.0)), (w1 + w2) * 0.5);
}


void main() {

  float unit = min(uResolution.x, uResolution.y) * 0.5;
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 p = (frag - uResolution * 0.5) / unit;
  float px = 1.0 / unit;
  float bw = max(uSurface.x, px);
  float e = clamp(bw * 0.2, px * 1.5, max(bw * 0.5, px * 1.5));
  float d = shapeAt(p);
  float aa = clamp(length(vec2(dFdx(d), dFdy(d))), px * 0.5, px * 1.5);
  vec2 g = vec2(0.0);
  Surface s;
  s.p = p;
  s.uv = frag / uResolution;
  s.frag = frag;
  s.res = uResolution;
  s.unit = unit;
  s.px = px;
  s.d = d;
  s.aa = aa;
  s.cov = clamp(0.5 - d / aa, 0.0, 1.0);
  s.slope = length(g);
  s.n = s.slope > 1e-5 ? g / s.slope : vec2(0.0);
  s.time = uTime;

  vec4 m = material(s);
  float reach = 1.0 - smoothstep(MATERIAL_REACH * 0.55, MATERIAL_REACH, d);
  float a = clamp(MATERIAL_OUTSIDE ? m.a * max(reach, s.cov) : m.a * s.cov, 0.0, 1.0);
  outColor = vec4(clamp(m.rgb, 0.0, 1.0) * a, a);
}
`;

const toRgba = value => {
  const hex = String(value || '#ffffff').replace('#', '');
  const full = hex.length <= 4 ? hex.split('').map(char => char + char).join('') : hex;
  const channel = index => parseInt(full.slice(index, index + 2), 16) / 255;
  return [channel(0), channel(2), channel(4), full.length >= 8 ? channel(6) : 1];
};

const solve = (grid, offset, stride, length, f, v, z) => {
  for (let i = 0; i < length; i++) f[i] = grid[offset + i * stride];
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < length; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    grid[offset + q * stride] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
};

const distances = (grid, width, height) => {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < width; x++) solve(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) solve(grid, y * width, 1, width, f, v, z);
};

const loadField = src =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const long = 640;
      const ratio = image.width / image.height || 1;
      const width = Math.round(ratio >= 1 ? long : long * ratio);
      const height = Math.round(ratio >= 1 ? long / ratio : long);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const outer = new Float64Array(width * height);
      const inner = new Float64Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const a = pixels[i * 4 + 3] / 255;
        const edge = 0.5 - a;
        outer[i] = a >= 1 ? 0 : a <= 0 ? 1e20 : edge > 0 ? edge * edge : 0;
        inner[i] = a <= 0 ? 0 : a >= 1 ? 1e20 : edge < 0 ? edge * edge : 0;
      }
      distances(outer, width, height);
      distances(inner, width, height);
      const unit = Math.min(width, height) / 2;
      const data = new Float32Array(width * height);
      for (let i = 0; i < data.length; i++) data[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / unit;
      resolve({ data, width, height });
    };
    image.onerror = reject;
    image.src = src;
  });


const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

export default function LogoBgBlackMark({
  src = logo,
  className,
  style,
  colorA = "#ffffff",
  colorB = "#94a3b8",
  palette = 1,
  size = 0.05,
  height = 0.5,
  bevel = 0.8,
  tilt = 0.5,
  lightAngle = 186,
  shadows = 0.85,
  seams = 0.33,
  jitter = 0.64,
  gloss = 1
}) {
  const canvasRef = useRef(null);
  const settings = useRef({});
  settings.current = { colorA, colorB, palette, size, height, bevel, tilt, lightAngle, shadows, seams, jitter, gloss };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return undefined;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const uniform = name => gl.getUniformLocation(program, name);
    const texture = gl.createTexture();
    const surface = gl.createTexture();
    let field = null;
    let frame = 0;
    let alive = true;
    const started = performance.now();

    const pack = ({ colorA, colorB, palette, size, height, bevel, tilt, lightAngle, shadows, seams, jitter, gloss }) => {
      const floats = new Float32Array(32);
      const colors = new Float32Array(64);
  colors.set(toRgba(colorA), 0);
  colors.set(toRgba(colorB), 4);
  floats[0] = Number(palette) || 0;
  floats[1] = Number(size) || 0;
  floats[2] = Number(height) || 0;
  floats[3] = Number(bevel) || 0;
  floats[4] = Number(tilt) || 0;
  floats[5] = Number(lightAngle) || 0;
  floats[6] = Number(shadows) || 0;
  floats[7] = Number(seams) || 0;
  floats[8] = Number(jitter) || 0;
  floats[9] = Number(gloss) || 0;
      return { floats, colors };
    };

    const render = now => {
      frame = requestAnimationFrame(render);
      if (!field) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const { floats, colors } = pack(settings.current);
      const fieldUnit = Math.min(field.width, field.height) / 2;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniform('uResolution'), width, height);
      gl.uniform2f(uniform('uFieldScale'), fieldUnit / field.width, fieldUnit / field.height);
      gl.uniform1f(uniform('uTime'), (now - started) / 1000);
      gl.uniform4fv(uniform('uMatP'), floats);
      gl.uniform4fv(uniform('uMatC'), colors);
      gl.uniform4f(uniform('uSurface'), 0.05, 0, 0, 0);
      gl.uniform1i(uniform('uField'), 0);
      gl.uniform1i(uniform('uSurf'), 1);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    loadField(src)
      .then(result => {
        if (!alive) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, result.width, result.height, 0, gl.RED, gl.FLOAT, result.data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        field = result;
      })
      .catch(() => {});
    frame = requestAnimationFrame(render);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      gl.deleteTexture(texture);
      gl.deleteTexture(surface);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', ...style }}
    />
  );
}

LogoBgBlackMark.credits = 'Material adapted from Shaders.com by Shader Effects Inc., MIT License, https://github.com/shader-effects-inc/shaders';
