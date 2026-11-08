"""Make material-only color variants of the original glass jellyfish."""
import json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/models'
source=(root/'glass-jellyfish.glb').read_bytes()
length=struct.unpack_from('<I',source,12)[0]
original=json.loads(source[20:20+length]);binary=source[20+length:]
palettes={
 'orange':[[.98,.54,.18],[.92,.22,.035],[1,.77,.42]],
 'pink':[[.98,.55,.77],[.85,.16,.48],[1,.78,.88]],
}
for name,colors in palettes.items():
 doc=json.loads(json.dumps(original))
 for material,color in zip(doc['materials'],colors):
  material['name']=name.title()+' '+material['name']
  material['pbrMetallicRoughness']['baseColorFactor']=[*color,1]
  material['extensions']['KHR_materials_volume']['attenuationColor']=colors[0]
  material['emissiveFactor']=[v*.055 for v in color]
 j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 out=struct.pack('<III',0x46546c67,2,20+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+binary
 assert len(out)==struct.unpack_from('<I',out,8)[0]
 path=root/f'glass-jellyfish-{name}.glb';path.write_bytes(out);print(path)
