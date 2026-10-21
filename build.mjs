// Sastavlja foldere iz ravnih fajlova (izvršava se na Netlify-u pri gradnji)
import {mkdirSync,copyFileSync,rmSync} from 'node:fs';
const fn=['api','auto-run-background','cron-dnevno'];
const lib=['auto','http','gemini','store','merge','iw-port','brief-port','api-handler'];
rmSync('public',{recursive:true,force:true});rmSync('netlify',{recursive:true,force:true});
mkdirSync('public',{recursive:true});mkdirSync('netlify/functions',{recursive:true});mkdirSync('netlify/lib',{recursive:true});
copyFileSync('index.html','public/index.html');
for(const f of fn)copyFileSync(f+'.mjs','netlify/functions/'+f+'.mjs');
for(const f of lib)copyFileSync(f+'.mjs','netlify/lib/'+f+'.mjs');
console.log('OK: public + netlify/functions + netlify/lib');
