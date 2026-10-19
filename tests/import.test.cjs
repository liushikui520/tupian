const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');const JSZip=require('../dist/vendor/jszip.min.js');
const ids=[...fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(){return {value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},querySelector(){return element()},click(){},focus(){}}}
const els=Object.fromEntries(ids.map(id=>[id,element()]));els.sort.value='recent';
const context=vm.createContext({console,Blob,File,URL,TextDecoder,JSZip,indexedDB,crypto,Option:function(text,value){this.text=text;this.value=value},setTimeout,clearTimeout,navigator:{},document:{getElementById:id=>{assert.ok(els[id],id);return els[id]},querySelectorAll:()=>[],addEventListener(){},createElement:element},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/app.js'),'utf8'),context);
test('ZIP import and error handling',async()=>{
 context.crypto={getRandomValues:crypto.getRandomValues.bind(crypto)};
 assert.match(vm.runInContext('createImageId()',context),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 const zip=new JSZip();zip.file('旅行/山景.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6V7sAAAAASUVORK5CYII=','base64'));zip.file('说明.txt','测试');const data=await zip.generateAsync({type:'uint8array'});
 context.fixture=new File([data],'照片.zip',{type:'application/zip'});
 vm.runInContext("view='fav';folder='旧目录';$('search').value='无匹配';$('type').value='GIF'",context);
 // Import immediately, before IndexedDB initialization completes.
 await vm.runInContext('importFiles([fixture])',context);
 assert.equal(vm.runInContext('items.length',context),1);assert.equal(vm.runInContext('shown.length',context),1);assert.equal(els.search.value,'');assert.match(els.importNotice.textContent,/新增 1 张/);
 const stored=await vm.runInContext('load()',context);assert.equal(stored.length,1);assert.equal(stored[0].path,'旅行/山景.png');assert.ok(stored[0].blob.size>0);
 await vm.runInContext('importFiles([fixture])',context);assert.equal(vm.runInContext('items.length',context),1);assert.match(els.importNotice.textContent,/已在图片库中/);
 context.fixture=new File(['broken'],'损坏.zip');await vm.runInContext('importFiles([fixture])',context);assert.equal(els.importNotice.dataset.state,'error');assert.match(els.importNotice.textContent,/不完整|损坏/);
 const empty=new JSZip();empty.file('readme.txt','none');context.fixture=new File([await empty.generateAsync({type:'uint8array'})],'空图片.zip');await vm.runInContext('importFiles([fixture])',context);assert.match(els.importNotice.textContent,/未找到可导入/);
 context.fixture=new File(['x'],'例子.rar');await vm.runInContext('importFiles([fixture])',context);assert.match(els.importNotice.textContent,/RAR/);
 context.JSZip=undefined;context.fixture=new File([data],'照片.zip');await vm.runInContext('importFiles([fixture])',context);assert.match(els.importNotice.textContent,/解压组件未加载/);context.JSZip=JSZip;
 vm.runInContext("transaction=()=>Promise.reject(Object.assign(new Error('quota'),{name:'QuotaExceededError'}))",context);context.fixture=new File(['image'],'new.png');await vm.runInContext('importFiles([fixture])',context);assert.match(els.importNotice.textContent,/存储空间不足/);
 assert.equal(vm.runInContext('busy',context),false);assert.equal(els.importTop.disabled,false);
 console.log('PASS: startup-race import, Chinese ZIP paths, extraction, IndexedDB persistence, filters reset, duplicate import, invalid ZIP, no-image ZIP, unsupported format, controls restored');
});
