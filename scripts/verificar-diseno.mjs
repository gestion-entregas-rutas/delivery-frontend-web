import fs from 'node:fs';import crypto from 'node:crypto';
const baseline=JSON.parse(fs.readFileSync('docs/diseno-aprobado.baseline.json','utf8'));
let failures=0,styles=0,templates=0;
for(const[file,reference]of Object.entries(baseline)){
 if(!fs.existsSync(file)){console.error('Falta el archivo aprobado:',file);failures++;continue;}
 const text=fs.readFileSync(file,'utf8');
 if(file.endsWith('.css')){styles++;if(crypto.createHash('sha256').update(text).digest('hex')!==reference.sha256){console.error('Se modificaron estilos aprobados:',file);failures++;}}
 else {templates++;const current=[...text.matchAll(/\bclass="([^"]*)"/g)].map(m=>m[1]);let index=0;for(const value of current)if(value===reference.classes[index])index++;if(index!==reference.classes.length){console.error('Cambió o se retiró una clase aprobada en:',file,'a partir de',reference.classes[index]);failures++;}}
}
console.log(`${styles} hojas de estilo sin cambios; ${templates} plantillas con clases aprobadas conservadas. Se permiten controles funcionales adicionales.`);
if(failures)process.exitCode=1;
