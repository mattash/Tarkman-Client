const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const files=cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard','apps/mobile','packages','tools/metro']).toString().trim().split('\n').sort();
const hashes=Object.fromEntries(files.filter(f=>fs.statSync(f).isFile()).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const aggregate=crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
fs.writeFileSync(__dirname+'/after-source.json',JSON.stringify({head:cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),note:'Shared source initially dirty; exact source hashes identify capture source independently of commit timing. No clean-commit claim.',aggregate,hashes},null,2));console.log(aggregate);
