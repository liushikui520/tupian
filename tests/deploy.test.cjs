const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..');
test('Installer deploys and updates without overwriting settings or unrelated directories',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tupian-deploy-'));
 try{
  const source=path.join(temp,'source','tupian-main');fs.mkdirSync(source,{recursive:true});
  for(const name of ['dist','deploy','deploy.sh','Dockerfile','compose.yaml','.env.example'])fs.cpSync(path.join(repo,name),path.join(source,name),{recursive:true});
  const archive=path.join(temp,'source.tar.gz');execFileSync('tar',['-czf',archive,'-C',path.dirname(source),'tupian-main']);
  const bin=path.join(temp,'bin');fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,'docker'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$TUPIAN_TEST_LOG"\nexit 0\n',{mode:0o755});
  fs.writeFileSync(path.join(bin,'curl'),'#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n if [ "$1" = "-o" ]; then shift; cp "$TUPIAN_TEST_ARCHIVE" "$1"; exit; fi\n shift\ndone\nexit 2\n',{mode:0o755});
  const target=path.join(temp,'installed with spaces');
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,TUPIAN_TEST_LOG:path.join(temp,'docker.log'),TUPIAN_TEST_ARCHIVE:archive};
  const install=(...args)=>execFileSync('bash',[path.join(repo,'install.sh'),...args],{env,stdio:'pipe'}).toString();
  install('--dir',target,'--port','18080');
  assert.ok(fs.existsSync(path.join(target,'.tupian-install')));assert.match(fs.readFileSync(path.join(target,'.env'),'utf8'),/PORT=18080/);
  fs.appendFileSync(path.join(target,'.env'),'\nCUSTOM_SETTING=preserved\n');install('--dir',target);
  assert.match(fs.readFileSync(path.join(target,'.env'),'utf8'),/CUSTOM_SETTING=preserved/);assert.match(fs.readFileSync(path.join(target,'.env'),'utf8'),/PORT=18080/);
  const calls=fs.readFileSync(env.TUPIAN_TEST_LOG,'utf8');assert.match(calls,/up -d --build --wait --wait-timeout 90/);
  assert.throws(()=>install('--dir',target,'--port','0'));assert.throws(()=>install('--dir',target,'--port','65536'));assert.throws(()=>install('--dir',target,'--port','abc'));
  const unrelated=path.join(temp,'unrelated');fs.mkdirSync(unrelated);fs.writeFileSync(path.join(unrelated,'keep.txt'),'keep');
  assert.throws(()=>install('--dir',unrelated));assert.equal(fs.readFileSync(path.join(unrelated,'keep.txt'),'utf8'),'keep');
  assert.throws(()=>install('--dir','/'));assert.throws(()=>install('--dir','relative'));
  execFileSync('bash',[path.join(target,'deploy.sh'),'stop'],{env,stdio:'pipe'});assert.match(fs.readFileSync(env.TUPIAN_TEST_LOG,'utf8'),/down/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
