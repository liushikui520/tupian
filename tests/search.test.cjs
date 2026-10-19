const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');const JSZip=require('../dist/vendor/jszip.min.js');
const ids=[...fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(){return {value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},querySelector(){return element()},click(){},focus(){}}}
const els=Object.fromEntries(ids.map(id=>[id,element()]));els.sort.value='recent';
const context=vm.createContext({console,Blob,File,URL,TextDecoder,JSZip,indexedDB,crypto,Option:function(text,value){this.text=text;this.value=value},setTimeout,clearTimeout,navigator:{},document:{getElementById:id=>{assert.ok(els[id],id);return els[id]},querySelectorAll:()=>[],addEventListener(){},createElement:element},window:{addEventListener(){}}});

vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/app.js'),'utf8'),context);
test('Hotel name and check-in date search',async()=>{
 await vm.runInContext('storageReady',context);
 context.fixtures=[
 {id:'a',name:'张三_2026-10-14_2026-10-15.png',folder:'酒店A'},
 {id:'b',name:'张三_2026-11-14_2026-11-16.jpg',folder:'酒店B'},
 {id:'c',name:'李四_2026-10-13_2026-10-14.png',folder:'酒店14'},
 {id:'d',name:'张三_2026-10-15_2026-10-16.png',folder:'酒店A'},
 {id:'e',name:'王五_2026-10-14_2026-10-15.png',folder:'酒店B'},
 {id:'f',name:'普通风景14.png',folder:'酒店C'},
 {id:'g',name:'赵六_2026-02-30_2026-03-01.png',folder:'酒店A'}
 ].map(x=>({...x,path:x.folder+'/'+x.name,blob:new Blob(['image']),added:1,fav:false}));
 vm.runInContext('items=fixtures.map(hydrate);render()',context);
 function search(text,scope=''){context.query=text;context.scope=scope;vm.runInContext("folder=scope;$('search').value=query;render()",context);return Array.from(vm.runInContext('shown.map(x=>x.id).sort()',context))}
 assert.deepEqual(search('14'),['a','b','e']);assert.deepEqual(search('14号'),['a','b','e']);assert.deepEqual(search('１４'),['a','b','e']);
 assert.deepEqual(search('2026-10-14'),['a','e']);assert.deepEqual(search('2026-10-15'),['d']);assert.deepEqual(search('张三'),['a','b','d']);assert.deepEqual(search('张三 14'),['a','b']);
 assert.deepEqual(search('14','酒店A'),['a']);assert.deepEqual(search('14','酒店B'),['b','e']);assert.deepEqual(search('张三','酒店B'),['b']);assert.deepEqual(search('14','酒店14'),[]);
 assert.deepEqual(search('2026-02-30'),[]);assert.deepEqual(search('普通风景'),['f']);assert.deepEqual(search('', '酒店A'),['a','d','g']);
 context.sample={name:'多_字_名称_2026-1-4_2026-1-5.png'};assert.equal(vm.runInContext('bookingOf(sample).checkIn.text',context),'2026-01-04');assert.equal(vm.runInContext('bookingOf(sample).name',context),'多_字_名称');
 assert.equal(vm.runInContext("matchesSearch(sample,['04'])",context),true);
 console.log('PASS: cross-folder check-in day search; checkout, folder-number and plain-filename false positives excluded; full dates; names; combined search; scoped results; invalid dates; legacy filenames; Unicode digits');
});
