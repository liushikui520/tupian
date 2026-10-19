const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');const JSZip=require('../dist/vendor/jszip.min.js');
const ids=[...fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(){return {value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},querySelector(){return element()},click(){},focus(){}}}
const els=Object.fromEntries(ids.map(id=>[id,element()]));els.sort.value='recent';
const context=vm.createContext({console,Blob,File,URL,TextDecoder,JSZip,indexedDB,crypto,Option:function(text,value){this.text=text;this.value=value},setTimeout,clearTimeout,navigator:{},document:{getElementById:id=>{assert.ok(els[id],id);return els[id]},querySelectorAll:()=>[],addEventListener(){},createElement:element},window:{addEventListener(){}}});

test('Folders, migration and image moves',async()=>{
 const old=await new Promise((resolve,reject)=>{const r=indexedDB.open('frame-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('images',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise((resolve,reject)=>{const t=old.transaction('images','readwrite');t.objectStore('images').put({id:'old-id',path:'旧相册/风景.png',name:'风景.png',blob:new Blob(['old'],{type:'image/png'}),added:1,fav:true});t.oncomplete=resolve;t.onerror=reject});old.close();
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/app.js'),'utf8'),context);await vm.runInContext('storageReady',context);
 assert.equal(vm.runInContext('db.version',context),2);assert.equal(vm.runInContext('items.length',context),1);assert.equal(vm.runInContext('items[0].fav',context),true);
 await vm.runInContext("createFolder('产品图')",context);assert.equal(vm.runInContext('folder',context),'产品图');assert.equal(vm.runInContext('shown.length',context),0);
 await assert.rejects(vm.runInContext("createFolder('产品图')",context),/同名/);await assert.rejects(vm.runInContext("createFolder('bad/name')",context),/斜线/);await assert.rejects(vm.runInContext("createFolder('   ')",context),/请输入/);
 const z=new JSZip();z.file('嵌套/风景.png','product');context.fixture=new File([await z.generateAsync({type:'uint8array'})],'产品.zip');await vm.runInContext('importFiles([fixture])',context);
 assert.equal(vm.runInContext('folder',context),'产品图');assert.equal(vm.runInContext('shown.length',context),1);assert.equal(vm.runInContext('shown[0].folder',context),'产品图');
 vm.runInContext("$('search').value='风景';render()",context);assert.equal(vm.runInContext('shown.length',context),1);assert.notEqual(vm.runInContext('shown[0].id',context),'old-id');
 await vm.runInContext("createFolder('旅行')",context);await vm.runInContext("moveImage('old-id','旅行')",context);assert.equal(vm.runInContext('shown.length',context),1);assert.equal(vm.runInContext('shown[0].fav',context),true);
 const records=await vm.runInContext('load()',context);assert.equal(records.find(x=>x.id==='old-id').folder,'旅行');
 const folders=await vm.runInContext("new Promise(resolve=>{const r=db.transaction('folders').objectStore('folders').getAll();r.onsuccess=()=>resolve(r.result)})",context);assert.deepEqual(folders.map(x=>x.name).sort(),['产品图','旅行'].sort());
 vm.runInContext("enterFolder('产品图');$('search').value='没有匹配';render()",context);assert.equal(vm.runInContext('shown.length',context),0);vm.runInContext("enterFolder('旅行')",context);assert.equal(els.search.value,'');assert.equal(vm.runInContext('shown.length',context),1);
 await vm.runInContext("moveImage('old-id','')",context);assert.equal(vm.runInContext('shown.length',context),0);assert.equal(vm.runInContext("folderOf(items.find(x=>x.id==='old-id'))",context),'');
 await assert.rejects(vm.runInContext("moveImage('old-id','不存在')",context),/不存在/);
 console.log('PASS: v1→v2 migration preserves images and favorites; empty folder persistence; validation; scoped ZIP import; folder-only search; move persistence; switching scopes; moving to unclassified');
});
