import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';

type Mesh = { positions: number[]; normals: number[]; uv: number[]; indices: number[] };
const chunks: Buffer[] = [], views: object[] = [], accessors: object[] = [], meshes: object[] = [], nodes: object[] = [];
let byteLength = 0;
function bufferView(bytes: Buffer, target?: number) {
  const offset = byteLength;
  const padding = (4 - bytes.length % 4) % 4;
  chunks.push(bytes, Buffer.alloc(padding)); byteLength += bytes.length + padding;
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
  return views.length - 1;
}
function accessor(values: number[], dimensions: number, indices = false) {
  const array = indices ? new Uint16Array(values) : new Float32Array(values);
  const bounds = Array.from({ length: dimensions }, (_, axis) => values.filter((_, i) => i % dimensions === axis));
  accessors.push({ bufferView: bufferView(Buffer.from(array.buffer), indices ? 34963 : 34962), componentType: indices ? 5123 : 5126,
    count: values.length / dimensions, type: ['SCALAR', 'VEC2', 'VEC3'][dimensions - 1],
    min: bounds.map((axis) => Math.min(...axis)), max: bounds.map((axis) => Math.max(...axis)) });
  return accessors.length - 1;
}
function mesh(name: string, shape: Mesh, material: number) {
  assert(shape.positions.length === shape.normals.length && shape.positions.length / 3 === shape.uv.length / 2);
  assert(shape.positions.every(Number.isFinite) && shape.indices.length % 3 === 0);
  assert(Math.max(...shape.indices) < shape.positions.length / 3 && shape.positions.length / 3 < 65536);
  meshes.push({ name, primitives: [{ attributes: { POSITION: accessor(shape.positions, 3), NORMAL: accessor(shape.normals, 3), TEXCOORD_0: accessor(shape.uv, 2) }, indices: accessor(shape.indices, 1, true), material }] });
  return meshes.length - 1;
}
function outline(width: number, height: number, radius: number) {
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  return corners.flatMap(([x, y], corner) => Array.from({ length: 17 }, (_, i) => {
    const angle = corner * Math.PI / 2 + i * Math.PI / 32;
    return [x! * (width / 2 - radius) + radius * Math.cos(angle), y! * (height / 2 - radius) + radius * Math.sin(angle), angle];
  }));
}
function roundedSurface(width: number, height: number, radius: number): Mesh {
  const points = outline(width, height, radius);
  const positions = [0, 0, 0, ...points.flatMap(([x, y]) => [x!, y!, 0])];
  return { positions, normals: positions.map((_, i) => i % 3 === 2 ? 1 : 0),
    uv: [.5, .5, ...points.flatMap(([x, y]) => [x! / width + .5, .5 - y! / height])],
    indices: points.flatMap((_, i) => [0, i + 1, (i + 1) % points.length + 1]) };
}
function enclosure(width: number, height: number, depth: number, radius: number, bevel: number): Mesh {
  assert(bevel < Math.min(radius, depth / 2) && radius < Math.min(width, height) / 2);
  const profiles = [
    { inset: bevel, z: -depth / 2, slope: -Math.PI / 2 },
    { inset: 0, z: -depth / 2 + bevel, slope: -Math.PI / 4 },
    { inset: 0, z: 0, slope: 0 },
    { inset: 0, z: depth / 2 - bevel, slope: Math.PI / 4 },
    { inset: bevel, z: depth / 2, slope: Math.PI / 2 },
  ];
  const shape: Mesh = { positions: [], normals: [], uv: [], indices: [] };
  const count = outline(width, height, radius).length;
  for (const { inset, z, slope } of profiles) for (const [x, y, angle] of outline(width - 2 * inset, height - 2 * inset, radius - inset)) {
    shape.positions.push(x!, y!, z);
    shape.normals.push(Math.cos(angle!) * Math.cos(slope), Math.sin(angle!) * Math.cos(slope), Math.sin(slope));
    shape.uv.push(x! / width + .5, .5 - y! / height);
  }
  for (let ring = 0; ring < profiles.length - 1; ring++) for (let i = 0; i < count; i++) {
    const a = ring * count + i, b = ring * count + (i + 1) % count;
    shape.indices.push(a, b, a + count, b, b + count, a + count);
  }
  const back = shape.positions.length / 3;
  shape.positions.push(0, 0, -depth / 2, 0, 0, depth / 2);
  shape.normals.push(0, 0, -1, 0, 0, 1); shape.uv.push(.5, .5, .5, .5);
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count, front = (profiles.length - 1) * count;
    shape.indices.push(back, next, i, back + 1, front + i, front + next);
  }
  return shape;
}
function object(name: string, mesh: number, translation = [0, 0, 0]) {
  nodes.push({ name, mesh, translation }); return nodes.length - 1;
}
function group(name: string, children: number[], translation: number[], yaw: number) {
  nodes.push({ name, children, translation, rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] }); return nodes.length - 1;
}

const images = [];
for (const variant of ['desktop', 'mobile']) {
  const uri = `../previews/contours-of-silence-11-${variant}.webp`;
  await access(new URL(uri.replace('../previews/', '../public/previews/'), import.meta.url));
  images.push({ uri });
}
const materials = [
  { name: 'Brushed metal', pbrMetallicRoughness: { baseColorFactor: [.42, .44, .50, 1], metallicFactor: .88, roughnessFactor: .28 } },
  { name: 'Black glass surround', pbrMetallicRoughness: { baseColorFactor: [.014, .014, .025, 1], metallicFactor: .18, roughnessFactor: .24 } },
  { name: 'Desktop wallpaper', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } },
  { name: 'Mobile wallpaper', pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } },
];
const monitor = group('Monitor', [
  object('Monitor chassis', mesh('Chamfered monitor chassis', enclosure(3.4, 1.99, .14, .12, .025), 0)),
  object('Monitor glass surround', mesh('Monitor glass surround', roundedSurface(3.34, 1.93, .095), 1), [0, 0, .071]),
  object('Monitor display', mesh('Desktop display', roundedSurface(3.16, 1.7775, .055), 2), [0, .015, .073]),
  object('Monitor support', mesh('Tapered support', enclosure(.25, .66, .18, .10, .03), 0), [0, -1.28, -.05]),
  object('Monitor foot', mesh('Sculpted monitor foot', enclosure(1.02, .095, .62, .04, .025), 0), [0, -1.59, .025]),
], [-.42, .48, -.18], -.10);
const phone = group('Phone', [
  object('Phone chassis', mesh('Chamfered phone chassis', enclosure(1.025, 2.12, .125, .145, .025), 0)),
  object('Phone glass surround', mesh('Phone glass surround', roundedSurface(.983, 2.075, .13), 1), [0, 0, .064]),
  object('Phone display', mesh('Mobile display', roundedSurface(.91, 1.967, .105), 3), [0, 0, .066]),
  object('Phone speaker', mesh('Speaker slot', roundedSurface(.17, .023, .010), 1), [0, .996, .068]),
  object('Phone volume key', mesh('Volume key', enclosure(.025, .28, .055, .012, .005), 0), [-.518, .37, 0]),
  object('Phone power key', mesh('Power key', enclosure(.025, .19, .055, .012, .005), 0), [.518, .22, 0]),
], [1.04, -.03, .42], -.22);

const binary = Buffer.concat(chunks);
const document = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [monitor, phone] }], nodes, meshes,
  materials, images, textures: [0, 1].map((source) => ({ sampler: 0, extensions: { EXT_texture_webp: { source } } })), samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  buffers: [{ byteLength }], bufferViews: views, accessors, extensionsUsed: ['KHR_materials_unlit', 'EXT_texture_webp'], extensionsRequired: ['EXT_texture_webp'] };
const json = Buffer.from(JSON.stringify(document));
const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binaryHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8);
jsonHeader.writeUInt32LE(padded.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, padded, binaryHeader, binary]);
assert(glb.length === glb.readUInt32LE(8) && glb.length < 1500000);
assert(byteLength === binary.length && images.length === 2 && meshes.length === 11);
const output = new URL('../public/models/', import.meta.url);
await mkdir(output, { recursive: true }); await writeFile(new URL('devices.glb', output), glb);
console.log(`Prepared original device scene: ${meshes.length} meshes, ${(glb.length / 1024).toFixed(0)} KiB.`);
