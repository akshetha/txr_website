"""Build a textured, procedural Quest 3 approximation as a self-contained GLB."""
import math, struct, json, random, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
buf=bytearray(); views=[]; access=[]; meshes=[]; nodes=[]
def blob(data,target=None):
 while len(buf)%4: buf.append(0)
 v={'buffer':0,'byteOffset':len(buf),'byteLength':len(data)}
 if target:v['target']=target
 views.append(v);buf.extend(data);return len(views)-1
def attr(values,n,kind=5126):
 flat=[x for p in values for x in p] if n>1 else values
 v=blob(struct.pack('<'+('f' if kind==5126 else 'I')*len(flat),*flat),34962 if kind==5126 else 34963)
 a={'bufferView':v,'componentType':kind,'count':len(values),'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[n]}
 if n==3:a.update(min=[min(p[i] for p in values) for i in range(3)],max=[max(p[i] for p in values) for i in range(3)])
 access.append(a);return len(access)-1
materials=[]
def mat(name,color,rough=.5,metal=0,texture=None):
 m={'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'roughnessFactor':rough,'metallicFactor':metal}}
 if texture is not None:m['pbrMetallicRoughness']['baseColorTexture']={'index':texture}
 materials.append(m);return len(materials)-1
shell=mat('Warm porcelain polymer',(0.87,.88,.86),.36)
seam=mat('Graphite shell seams',(.065,.07,.08),.7)
pad=mat('Smooth charcoal rubber cushion',(.045,.05,.06),.72)
strap=mat('Dark grey woven elastic',(.16,.17,.19),.92,texture=0)
black=mat('Sensor glass',(.012,.02,.035),.12,.35)
rim=mat('Sensor bevel',(.08,.09,.11),.34,.25)
lens=mat('Black glass with blue shimmer',(.004,.007,.014),.13,.25)
inner=mat('Interior matte graphite',(.035,.04,.05),.8)
highlight=mat('Subtle blue optical reflection',(.012,.025,.065),.2,.35)
def mesh(name,verts,faces,material,uv=None):
 normals=[[0.,0.,0.] for _ in verts]
 for a,b,c in faces:
  u=[verts[b][i]-verts[a][i] for i in range(3)];v=[verts[c][i]-verts[a][i] for i in range(3)]
  n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  for j in (a,b,c):
   for i in range(3):normals[j][i]+=n[i]
 # Share normals across duplicated UV seams for a continuous surface.
 groups={}
 for i,p in enumerate(verts):groups.setdefault(tuple(round(x,7) for x in p),[]).append(i)
 for indices in groups.values():
  total=[sum(normals[j][k] for j in indices) for k in range(3)]
  for j in indices:normals[j]=total.copy()
 for n in normals:
  l=math.sqrt(sum(x*x for x in n)) or 1
  for i in range(3):n[i]/=l
 attributes={'POSITION':attr(verts,3),'NORMAL':attr(normals,3)}
 if uv:attributes['TEXCOORD_0']=attr(uv,2)
 meshes.append({'name':name,'primitives':[{'attributes':attributes,'indices':attr([i for f in faces for i in f],1,5125),'material':material}]})
 nodes.append({'name':name,'mesh':len(meshes)-1})
def rings(name,sections,material,n=96,power=3.3,nose=False):
 vs=[];uv=[];fs=[]
 for j,(w,h,z,cx,cy) in enumerate(sections):
  for i in range(n+1):
   t=i/n*math.tau;c=math.cos(t);s=math.sin(t)
   x=w*math.copysign(abs(c)**(2/power),c);y=h*math.copysign(abs(s)**(2/power),s)
   if nose and y<0:y+=.015*min(1,h/.03)*math.exp(-(x/.022)**2)*(-y/h)**6
   vs.append((x+cx,y+cy,z));uv.append((i/n*12,j/max(1,len(sections)-1)*3))
 for j in range(len(sections)-1):
  for i in range(n):
   a=j*(n+1)+i;b=a+n+1;fs.extend([(a,a+1,b),(a+1,b+1,b)])
 mesh(name,vs,fs,material,uv)
def capsule(name,x,y,z,w,h,depth,material):
 rings(name,[(w*.86,h*.86,z-depth/2,x,y),(w,h,z,x,y),(w*.88,h*.88,z+depth/2,x,y),(.0001,.0001,z+depth/2+.0001,x,y)],material,64,2.8)
materials[lens]['extensions'] = {'KHR_materials_clearcoat': {'clearcoatFactor': 1, 'clearcoatRoughnessFactor': .08}, 'KHR_materials_specular': {'specularFactor': .65, 'specularColorFactor': [.12,.28,.65]}}
# All dimensions in metres, front +Z, wearer -Z.
rings('Rounded visor chassis',[(.082,.037,-.022,0,0),(.091,.043,-.015,0,0),(.094,.045,.007,0,0),(.091,.043,.024,0,0),(.084,.038,.030,0,0),(.0001,.0001,.033,0,0)],shell,nose=True)
rings('Front faceplate perimeter seam',[(.089,.041,.0255,0,0),(.0887,.0407,.0263,0,0)],seam,nose=True)
rings('Inset front faceplate',[(.0884,.0404,.0265,0,0),(.084,.037,.0308,0,0),(.0001,.0001,.0335,0,0)],shell,nose=True)
for x in [-.035,0,.035]:
 capsule('Dark strip bevel',x,-.009,.033,.0084,.017,.003,rim)
 capsule('Plain black front strip',x,-.009,.035,.007,.0155,.0015,black)
# Rounded face interface and a closed dark optical housing behind the lenses.
cushion=[]
for i in range(49):
 t=i/48*math.tau
 cushion.append((.078+.009*math.cos(t),.035+.009*math.cos(t),-.037+.016*math.sin(t),0,0))
rings('Continuous rounded rubber face cushion',cushion,pad,n=144,power=2.8,nose=True)
rings('Closed interior optical housing',[
 (.082,.036,-.021,0,0),(.080,.035,-.026,0,0),
 (.075,.032,-.029,0,0),(.060,.026,-.030,0,0),
 (.035,.018,-.031,0,0),(.0001,.0001,-.0315,0,0)
],inner,n=144,nose=True)
capsule('Solid dark nose bridge',0,-.010,-.033,.008,.016,.004,inner)
for x in [-.032,.032]:
 rings('Independent lens bezel',[(.026,.026,-.027,x,0),(.025,.025,-.037,x,0),(.0215,.0215,-.039,x,0)],inner,64,2.2)
 rings('Pancake optical lens',[(.0215,.0215,-.039,x,0),(.018,.018,-.0405,x,0),(.010,.010,-.0415,x,0),(.0001,.0001,-.042,x,0)],lens,64,2)
 rings('Lens outer coating reflection',[(.020,.020,-.040,x,0),(.0198,.0198,-.0402,x,0)],highlight,64,2)
# Straps are curved solid ribbons with woven UVs.
def ribbon(name,centers,width,thickness,material,vertical=False):
 vs=[];uv=[];fs=[];sides=12
 for j,(x,y,z) in enumerate(centers):
  before=centers[max(0,j-1)];after=centers[min(len(centers)-1,j+1)]
  tx,ty,tz=[after[k]-before[k] for k in range(3)]
  length=math.hypot(ty if vertical else tx,tz) or 1
  # Thickness follows the curved path instead of collapsing at its rear bend.
  normal=(0,-tz/length,ty/length) if vertical else (-tz/length,0,tx/length)
  for side in range(sides):
   t=side/sides*math.tau
   a=math.copysign(abs(math.cos(t))**.5,math.cos(t))*width/2
   b=math.copysign(abs(math.sin(t))**.5,math.sin(t))*thickness/2
   vs.append((x+(a if vertical else 0)+normal[0]*b,y+(0 if vertical else a)+normal[1]*b,z+normal[2]*b))
   uv.append((side/sides,j/(len(centers)-1)*16))
 for j in range(len(centers)-1):
  for k in range(sides):
   a=j*sides+k;b=j*sides+(k+1)%sides
   fs.extend([(a,b,a+sides),(b,b+sides,a+sides)])
 for k in range(1,sides-1):
  fs.append((0,k+1,k));a=(len(centers)-1)*sides;fs.append((a,a+k,a+k+1))
 mesh(name,vs,fs,material,uv)
for sign in [-1,1]:
 capsule('Side strap pivot',sign*.091,.005,-.018,.006,.018,.020,shell)
# Single uninterrupted U-shaped band removes the rear center seam.
pts=[]
for i in range(129):
 t=i/128*math.pi
 pts.append((-.094*math.cos(t),.003,-.025-.15*math.sin(t)))
ribbon('Continuous rear woven strap',pts,.025,.0025,strap)
pts=[]
for i in range(81):
 t=i/80*math.pi
 pts.append((0,.042*(1-i/80)+.012*(i/80)+.045*math.sin(t),-.018-.1555*i/80))
ribbon('Crown woven strap',pts,.022,.0025,strap,True)
# Small controls and vents.
for x in [-.051,-.046,-.041]:capsule('Lower microphone vent',x,-.038,.025,.001,.0007,.001,black)
capsule('Volume rocker',.044,-.041,.014,.010,.0018,.003,rim)
capsule('Status LED',.003,.030,.033,.001,.0006,.001,highlight)
# Deterministic textile base color texture, embedded in GLB.
rng=random.Random(9);size=256;raw=bytearray()
for y in range(size):
 raw.append(0)
 for x in range(size):
  weave=12*math.sin(x*math.pi/2)*math.cos(y*math.pi/2)
  c=int(max(0,min(255,210+weave+rng.uniform(-8,8))))
  raw.extend((c,c,c))
def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw)))+chunk(b'IEND',b'')
imageView=blob(png)
gltf={'extensionsUsed':['KHR_materials_clearcoat','KHR_materials_specular'],'asset':{'version':'2.0','generator':'TritonXR procedural headset builder','extras':{'description':'Quest 3 visual approximation from supplied references; not a CAD replica. Units: metres. Front +Z. Lenses -Z.'}},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,'buffers':[{'byteLength':len(buf)}],'bufferViews':views,'accessors':access,'images':[{'bufferView':imageView,'mimeType':'image/png'}],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buf.extend(b'\0'*((-len(buf))%4))
out=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buf))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buf),0x004e4942)+buf
path=ROOT/'assets/models/quest-3.glb';path.write_bytes(out)
print(f'{path}: {len(out):,} bytes, {len(meshes)} meshes')
