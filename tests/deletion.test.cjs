const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');const JSZip=require('../dist/vendor/jszip.min.js');
const ids=[...fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(){return {value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},querySelector(){return element()},click(){},focus(){}}}
const els=Object.fromEntries(ids.map(id=>[id,element()]));els.sort.value='recent';
const context=vm.createContext({console,Blob,File,URL,TextDecoder,JSZip,indexedDB,crypto,Option:function(text,value){this.text=text;this.value=value},setTimeout,clearTimeout,navigator:{},document:{getElementById:id=>{assert.ok(els[id],id);return els[id]},querySelectorAll:()=>[],addEventListener(){},createElement:element},window:{addEventListener(){}}});

vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/app.js'),'utf8'),context);
test('Reviewed deletion by exact check-in date',async()=>{
 await vm.runInContext('storageReady',context);
 context.fixtures=[
 {id:'a',name:'酒店甲_2026-10-14_2026-10-15.png',folder:'文件夹A'},
 {id:'b',name:'酒店甲_2026-10-14_2026-10-15.jpg',folder:'文件夹B'},
 {id:'c',name:'酒店乙_2026-10-14_2026-10-16.png',folder:'文件夹B'},
 {id:'d',name:'酒店乙_2026-10-13_2026-10-14.png',folder:'文件夹B'},
 {id:'e',name:'酒店甲_2026-11-14_2026-11-15.png',folder:'文件夹A'},
 {id:'f',name:'普通14.png',folder:'文件夹A'}
 ].map(x=>({...x,path:x.folder+'/'+x.name,blob:new Blob(['image']),added:1,fav:true}));
 await vm.runInContext("transaction('readwrite',s=>fixtures.forEach(x=>s.put(x)))",context);
 vm.runInContext("items=fixtures.map(hydrate);folder='文件夹A';view='fav';$('search').value='酒店甲';$('type').value='JPG';render()",context);
 assert.equal(vm.runInContext('shown.length',context),0);
 assert.deepEqual(Array.from(vm.runInContext("checkInMatches('2026-10-14').map(x=>x.id)",context)),['a','b','c']);
 assert.equal(vm.runInContext("deletionGroups(checkInMatches('2026-10-14')).length",context),2);
 els.deleteDate.value='2026-10-14';vm.runInContext('updateDeletePreview()',context);assert.match(els.deleteSummary.textContent,/2 个酒店名称 · 3 张图片/);assert.equal(els.confirmDeleteDate.disabled,false);
 await assert.rejects(vm.runInContext("deleteCheckInDate('14',['a','b','c'])",context),/完整入住日期/);
 await assert.rejects(vm.runInContext("deleteCheckInDate('2026-10-14',['a'])",context),/变化/);
 context.realTransaction=vm.runInContext('transaction',context);vm.runInContext("transaction=()=>Promise.reject(new Error('database failure'))",context);
 await assert.rejects(vm.runInContext("deleteCheckInDate('2026-10-14',['a','b','c'])",context),/database failure/);assert.equal(vm.runInContext('items.length',context),6);assert.equal(vm.runInContext('busy',context),false);context.transaction=context.realTransaction;
 const count=await vm.runInContext("deleteCheckInDate('2026-10-14',['a','b','c'])",context);assert.equal(count,3);
 assert.deepEqual(Array.from(vm.runInContext('items.map(x=>x.id)',context)),['d','e','f']);
 const saved=await vm.runInContext('load()',context);assert.deepEqual(saved.map(x=>x.id).sort(),['d','e','f']);assert.ok(saved.every(x=>x.fav));
 vm.runInContext('updateDeletePreview()',context);assert.equal(els.confirmDeleteDate.disabled,true);
 await assert.rejects(vm.runInContext("deleteCheckInDate('2026-10-14',[])",context),/没有可删除/);
 console.log('PASS: global date deletion across folders; hotel grouping; independent of active filters; stale-preview guard; atomic failure preserves records; persisted removal; checkout, other month and unparsed names retained; empty match disabled');
});
