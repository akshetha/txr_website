import * as THREE from 'three';
// Origins stay attached to the cushion perimeter in headset-local coordinates.
export function createElectricArcs(parent) {
  const group=new THREE.Group();group.name='Scroll electricity';parent.add(group);
  const bolts=[];
  for(let i=0;i<24;i++){
    const theta=i/24*Math.PI*2;
    const origin=new THREE.Vector3(Math.cos(theta)*.081,Math.sin(theta)*.038,.014);
    const direction=new THREE.Vector3(Math.cos(theta),Math.sin(theta),-.15).normalize();
    const positions=new Float32Array(12*2*3);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.LineBasicMaterial({color:i%3===0?0xb58bff:0xb9d8ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    const line=new THREE.LineSegments(geometry,material);line.frustumCulled=false;group.add(line);
    bolts.push({origin,direction,geometry,material,positions,index:i});
  }
  const light=new THREE.PointLight(0xa18aff,0,.6,2);light.position.set(0,0,-.015);group.add(light);
  let energy=0,previous=null;
  const noise=(seed)=>{const v=Math.sin(seed*127.1+311.7)*43758.5453;return (v-Math.floor(v))*2-1;};
  return {
    update(progress,now,dt){
      const delta=previous===null?0:Math.abs(progress-previous);previous=progress;
      const moving=Math.min(1,delta/Math.max(.001,dt/1000)*2);
      energy=Math.max(moving,energy*Math.exp(-dt/450));
      const entrance=THREE.MathUtils.smoothstep(progress,.60,.65);
      const exit=1-THREE.MathUtils.smoothstep(progress,.84,.92);
      const strength=entrance*exit*energy;
      group.visible=strength>.015;
      light.intensity=strength*.018;
      if(!group.visible)return;
      const tick=Math.floor(now/65);
      for(const bolt of bolts){
        const {origin,direction,positions,index}=bolt;
        const seed=tick+index*37;
        bolt.material.opacity=strength*(.45+.55*Math.abs(noise(seed)));
        const reach=.045+.10*(.5+.5*noise(seed+4));
        let previousPoint=origin;
        const points=[origin];
        for(let step=1;step<=8;step++){
          const t=step/8;
          const p=origin.clone().addScaledVector(direction,reach*t);
          const jitter=.011*Math.sin(t*Math.PI);
          p.x+=noise(seed+step*3)*jitter;p.y+=noise(seed+step*3+1)*jitter;
          p.z+=noise(seed+step*3+2)*jitter;
          points.push(p);
          previousPoint.toArray(positions,(step-1)*6);p.toArray(positions,(step-1)*6+3);previousPoint=p;
        }
        // A shorter fork branches from the middle of each bolt.
        const branchStart=points[4];previousPoint=branchStart;
        for(let step=1;step<=4;step++){
          const p=branchStart.clone().addScaledVector(direction,reach*.45*step/4);
          p.x+=-direction.y*.025*step/4+noise(seed+step+90)*.004;
          p.y+=direction.x*.025*step/4+noise(seed+step+120)*.004;
          previousPoint.toArray(positions,(7+step)*6);p.toArray(positions,(7+step)*6+3);previousPoint=p;
        }
        bolt.geometry.attributes.position.needsUpdate=true;
      }
    },
    dispose(){for(const bolt of bolts){bolt.geometry.dispose();bolt.material.dispose();}group.removeFromParent();}
  };
}
