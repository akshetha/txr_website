"""Simple blue glass jellyfish. Generates a standalone GLB in metres."""
import math,struct,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
buffer=bytearray();views=[];accessors=[];meshes=[];nodes=[]
def data(payload,target):
 while len(buffer)%4:buffer.append(0)
 views.append({'buffer':0,'byteOffset':len(buffer),'byteLength':len(payload),'target':target});buffer.extend(payload);return len(views)-1
def accessor(values,width,integer=False):
 flat=[v for row in values for v in row] if width>1 else values
 view=data(struct.pack('<'+('I' if integer else 'f')*len(flat),*flat),34963 if integer else 34962)
 result={'bufferView':view,'componentType':5125 if integer else 5126,'count':len(values),'type':{1:'SCALAR',3:'VEC3'}[width]}
 if width==3:result.update(min=[min(p[i] for p in values) for i in range(3)],max=[max(p[i] for p in values) for i in range(3)])
 accessors.append(result);return len(accessors)-1
def mesh(name,vertices,faces,material):
 normals=[[0.,0.,0.] for p in vertices]
 for a,b,c in faces:
  u=[vertices[b][i]-vertices[a][i] for i in range(3)];v=[vertices[c][i]-vertices[a][i] for i in range(3)]
  n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  for j in (a,b,c):
   for i in range(3):normals[j][i]+=n[i]
 groups={}
 for i,p in enumerate(vertices):groups.setdefault(tuple(round(v,6) for v in p),[]).append(i)
 for indices in groups.values():
  n=[sum(normals[j][i] for j in indices) for i in range(3)];length=math.sqrt(sum(v*v for v in n)) or 1
  for j in indices:normals[j]=[v/length for v in n]
 meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':accessor(vertices,3),'NORMAL':accessor(normals,3)},'indices':accessor([i for face in faces for i in face],1,True),'material':material}]});nodes.append({'name':name,'mesh':len(meshes)-1})
def grid(name,rows,material):
 cols=len(rows[0]);vertices=[p for row in rows for p in row];faces=[]
 for j in range(len(rows)-1):
  for i in range(cols-1):
   a=j*cols+i;b=a+cols;faces.extend([(a,a+1,b),(a+1,b+1,b)])
 mesh(name,vertices,faces,material)
def glass(name,color,transmission,roughness,emission):
 return {'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':0,'roughnessFactor':roughness},'emissiveFactor':emission,'extensions':{'KHR_materials_transmission':{'transmissionFactor':transmission},'KHR_materials_ior':{'ior':1.45},'KHR_materials_volume':{'thicknessFactor':.025,'attenuationColor':[.35,.72,1],'attenuationDistance':2},'KHR_materials_clearcoat':{'clearcoatFactor':1,'clearcoatRoughnessFactor':.07}}}
materials=[glass('Pale blue glass bell',[.55,.83,1],.9,.12,[.005,.025,.045]),glass('Blue glass tendrils',[.12,.5,.85],.72,.14,[.01,.06,.12]),glass('Clear glass rim',[.7,.9,1],.95,.07,[0,.015,.03])]
# Rounded bell with a thin inner wall and subtly scalloped lip.
rows=[]
profile=[]
for j in range(33):
 t=j/32*math.pi/2;profile.append((.7*math.sin(t),.53*math.cos(t),j/32))
for j in range(32,-1,-1):
 t=j/32*math.pi/2;profile.append((max(.0001,.675*math.sin(t)),.505*math.cos(t)-.012,j/32))
for radius,y,edge in profile:
 rows.append([(radius*math.cos(a),y-.035*edge**8*(1+.5*math.cos(a*8)),radius*math.sin(a)) for a in [i/96*math.tau for i in range(97)]])
grid('Thin rounded glass bell',rows,0)
# Glass bead around the lip.
rows=[]
for j in range(13):
 t=j/12*math.tau
 rows.append([((.687+.014*math.cos(t))*math.cos(a),-.035*(1+.5*math.cos(a*8))+.014*math.sin(t),(.687+.014*math.cos(t))*math.sin(a)) for a in [i/96*math.tau for i in range(97)]])
grid('Soft glass lip',rows,2)
def tendril(index,thick=False):
 angle=index*2.39996;length=1.25+(index%4)*.16;start=.20 if thick else .44
 rows=[]
 for j in range(65):
  t=j/64;y=-.03-length*t
  x=start*math.cos(angle)+(.05+.10*t)*math.sin(t*5+angle)*t
  z=start*math.sin(angle)+(.06+.08*t)*math.cos(t*4+angle)*t
  radius=(.025 if thick else .007)*(1-t)**.7+.0008
  rows.append([(x+radius*math.cos(i/8*math.tau),y,z+radius*math.sin(i/8*math.tau)) for i in range(9)])
 grid(('Inner flowing arm ' if thick else 'Fine glass tentacle ')+str(index+1),rows,1 if thick or index%2 else 2)
for i in range(10):tendril(i)
for i in range(4):tendril(i+10,True)
# Four soft internal curves suggest the jellyfish's central anatomy.
for k in range(4):
 angle=k*math.pi/2;rows=[]
 for j in range(33):
  t=j/32;center=.32*math.sin(t*math.pi/2);y=.40*(1-t)
  rows.append([((center+.012*math.cos(a))*math.cos(angle),y+.012*math.sin(a),(center+.012*math.cos(a))*math.sin(angle)) for a in [i/8*math.tau for i in range(9)]])
 grid('Inner bell rib '+str(k+1),rows,1)
gltf={'asset':{'version':'2.0','generator':'TritonXR simple glass jellyfish'},'extensionsUsed':['KHR_materials_transmission','KHR_materials_ior','KHR_materials_volume','KHR_materials_clearcoat'],'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,'buffers':[{'byteLength':len(buffer)}],'bufferViews':views,'accessors':accessors}
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buffer+=b'\0'*((-len(buffer))%4)
out=struct.pack('<III',0x46546c67,2,28+len(j)+len(buffer))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buffer),0x004e4942)+buffer
path=ROOT/'assets/models/glass-jellyfish.glb';path.parent.mkdir(exist_ok=True,parents=True);path.write_bytes(out)
assert struct.unpack_from('<I',out,8)[0]==len(out)
print(f'Created {path}: {len(out):,} bytes, {len(meshes)} meshes')
