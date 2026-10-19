'use strict';
const $=id=>document.getElementById(id);let db,customFolders=[],items=[],shown=[],view='all',folder='',current=0,busy=false,timer,storageReady;
const ext=p=>p.split('.').pop().toUpperCase().replace('JPEG','JPG');const supported=p=>/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(p);const size=n=>n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';const mime=p=>({'JPG':'image/jpeg','PNG':'image/png','WEBP':'image/webp','GIF':'image/gif','AVIF':'image/avif','BMP':'image/bmp','SVG':'image/svg+xml'})[ext(p)];
function toast(s,sticky=false){clearTimeout(timer);$('status').textContent=s;$('status').style.display='block';if(!sticky)timer=setTimeout(()=>$('status').style.display='none',4500)}
function transaction(mode,action,storeName='images'){return new Promise((resolve,reject)=>{const t=db.transaction(storeName,mode);action(t.objectStore(storeName));t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('存储失败'))})}
function load(){return new Promise((resolve,reject)=>{const r=db.transaction('images').objectStore('images').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
const folderOf=x=>x.folder??(x.path.includes('/')?x.path.slice(0,x.path.lastIndexOf('/')):'');
const allFolders=()=>[...new Set([...customFolders,...items.map(folderOf).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'zh-CN'));
function normalized(value){return value.normalize('NFKC').toLocaleLowerCase().trim()}
function validDate(value){
 const match=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);if(!match)return null;
 const [,year,month,day]=match;const date=new Date(Date.UTC(+year,+month-1,+day));
 if(date.getUTCFullYear()!==+year||date.getUTCMonth()!==+month-1||date.getUTCDate()!==+day)return null;
 return {year:+year,month:+month,day:+day,text:year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0')};
}
function bookingOf(image){
 const stem=normalized(image.name).replace(/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i,'');
 const match=/^(.+?)_(\d{4}-\d{1,2}-\d{1,2})_(\d{4}-\d{1,2}-\d{1,2})(?:[_ (].*)?$/.exec(stem);
 if(!match)return {name:stem};
 const checkIn=validDate(match[2]),checkOut=validDate(match[3]);
 return checkIn&&checkOut?{name:match[1],checkIn,checkOut}:{name:stem};
}
function matchesSearch(image,query){
 const booking=bookingOf(image);
 return query.every(token=>{
  token=normalized(token);
  const day=/^(\d{1,2})(?:号|日)?$/.exec(token);
  if(day&&+day[1]>=1&&+day[1]<=31)return booking.checkIn?.day===+day[1];
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(token)){const date=validDate(token);return !!date&&booking.checkIn?.text===date.text}
  return booking.name.includes(token);
 });
}
function hydrate(x){return {...x,url:URL.createObjectURL(x.blob)}}
function render(){const q=$('search').value.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),type=$('type').value;shown=items.filter(x=>(view!=='fav'||x.fav)&&(!folder||folderOf(x)===folder)&&(!type||ext(x.name)===type)&&matchesSearch(x,q));shown.sort($('sort').value==='name'?(a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}):$('sort').value==='size'?(a,b)=>b.blob.size-a.blob.size:(a,b)=>b.added-a.added);$('total').textContent=items.length;$('favCount').textContent=items.filter(x=>x.fav).length;$('resultCount').textContent=`共 ${shown.length} 张图片${shown.length!==items.length?' / 图片库 '+items.length+' 张':''}`;$('pageTitle').textContent=folder?folder.split('/').pop():view==='fav'?'我的收藏':'全部图片';const dot=document.createElement('span');dot.className='title-dot';dot.textContent='.';$('pageTitle').append(dot);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',!folder&&b.dataset.view===view));const folders=allFolders();$('search').placeholder=folder?'在「'+folder+'」中搜索名称或入住日，如 14…':'搜索名称或入住日，如 14、2026-10-14…';const scope=$('folderScope');scope.replaceChildren(new Option('全部图片',''),...folders.map(p=>new Option(p,p)));scope.value=folder;$('folderCount').textContent=folders.length;$('folders').replaceChildren(...folders.map(p=>{const b=document.createElement('button');b.className='nav folder'+(folder===p?' active':'');b.textContent='▱  '+p;b.title=p;b.onclick=()=>{enterFolder(p)};return b}));$('gallery').replaceChildren(...shown.map((x,i)=>{const card=document.createElement('article');card.className='card';const btn=document.createElement('button');btn.className='thumb';btn.setAttribute('aria-label','预览 '+x.name);const img=document.createElement('img');img.src=x.url;img.alt=x.name;img.loading='lazy';img.onerror=()=>{img.alt='浏览器无法预览：'+x.name};btn.append(img);btn.onclick=()=>openViewer(i);const info=document.createElement('div');info.className='card-info';const name=document.createElement('div');name.className='card-name';name.textContent=x.name;name.title=x.path;const detail=document.createElement('div');detail.className='card-detail';detail.textContent=ext(x.name)+' · '+size(x.blob.size);info.append(name,detail);const booking=bookingOf(x);if(booking.checkIn){const dates=document.createElement('div');dates.className='booking-dates';dates.textContent='入住 '+booking.checkIn.text+' · 退房 '+booking.checkOut.text;info.append(dates)}const heart=document.createElement('button');heart.className='heart'+(x.fav?' selected':'');heart.textContent=x.fav?'♥':'♡';heart.setAttribute('aria-label',x.fav?'取消收藏':'收藏');heart.onclick=()=>toggleFav(x);const moveButton=document.createElement('button');moveButton.className='move-button';moveButton.textContent='移动到文件夹';moveButton.onclick=()=>openMove(x);info.append(moveButton);card.append(btn,info,heart);return card}));$('empty').hidden=shown.length>0;if(!shown.length){$('empty').querySelector('h2').textContent=folder?'这个文件夹还没有匹配的图片':items.length?'没有找到符合条件的图片':'你的灵感，从这里开始';$('empty').querySelector('p').textContent=folder?'可以直接在此导入图片，或通过图片下方的“移动到文件夹”整理已有图片。':items.length?'试试其他关键词、格式或文件夹，也可以继续导入图片。':'导入第一份图片包，把散落的图片整理成自己的相册。搜索、收藏、预览，找到图片就是这么简单。'} }
async function toggleFav(x){const next=!x.fav;try{await transaction('readwrite',s=>s.put({...x,url:undefined,fav:next}));x.fav=next;render();if($('viewer').open)showImage()}catch(e){toast('收藏保存失败，请检查浏览器存储空间')}}
function importNotice(message,state='error'){
 const box=$('importNotice');box.hidden=false;box.dataset.state=state;box.textContent=message;
}
function importError(error){
 const text=error?.message||String(error);
 if(error?.name==='QuotaExceededError')return '浏览器存储空间不足。请释放空间，或把 ZIP 分成较小的包后再导入。';
 if(/encrypt|password/i.test(text))return '这个 ZIP 设置了密码，暂不能直接读取。请先在电脑上解压，再使用“导入文件夹”。';
 if(/multi.volumes|multi-volume/i.test(text))return '暂不支持分卷 ZIP。请先合并解压，再导入文件夹。';
 if(/Corrupted|end of central|zip file|signature/i.test(text))return 'ZIP 文件不完整、已损坏或实际格式不是 ZIP。请在电脑上确认能解压，或改用“导入文件夹”。';
 if(/compression/i.test(text))return '这个 ZIP 使用了不支持的压缩方式。请先解压后导入文件夹，或用标准 ZIP 重新压缩。';
 return text;
}
async function importFiles(files){
 if(busy){toast('正在导入，请等待当前任务完成');return}
 if(!files.length)return;
 const targetFolder=folder;busy=true;let added=0,duplicates=0,skipped=0,failed=0,firstFailure='';
 const buttons=['importTop','importEmpty','chooseZip','chooseFolder'];buttons.forEach(id=>$(id).disabled=true);
 const progress=message=>{importNotice(message,'progress');toast(message,true)};
 async function add(path,blob){
  try{if(await saveImage(path,blob,targetFolder))added++;else duplicates++}
  catch(e){if(e.name==='QuotaExceededError')throw e;failed++;firstFailure ||= importError(e)}
 }
 try{
  progress('正在准备本地图片库…');await storageReady;
  if(!db)throw Error('本地存储不可用。请在普通浏览器窗口打开网站并允许网站存储，然后重试。');
  for(const file of files){
   progress('正在读取 '+file.name+'…');
   if(/\.zip$/i.test(file.name)){
    if(typeof JSZip==='undefined')throw Error('ZIP 解压组件未加载。请刷新网页后重试，或使用“导入文件夹”。');
    if(file.size>500*1048576)throw Error('单个 ZIP 请控制在 500 MB 以内，较大的图片库请先解压后导入文件夹。');
    const bytes=await file.arrayBuffer();
    const zip=await JSZip.loadAsync(bytes,{decodeFileName:bytes=>{
     try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return new TextDecoder('gb18030').decode(bytes)}
    }});
    const all=Object.values(zip.files).filter(e=>!e.dir&&!e.name.startsWith('__MACOSX/')&&!e.name.split('/').pop().startsWith('._'));
    const entries=all.filter(e=>supported(e.name));skipped+=all.length-entries.length;
    if(!entries.length){const formats=[...new Set(all.map(e=>ext(e.name)))].slice(0,6).join('、');throw Error('ZIP 内未找到可导入的图片'+(formats?'（包含：'+formats+'）':'')+'。支持 JPG、PNG、WEBP、GIF、AVIF、BMP 和 SVG；请确认压缩包中不是另一个压缩包。')}
    if(entries.length>10000)throw Error('单个压缩包最多导入 10,000 张图片，请分批导入。');
    for(let i=0;i<entries.length;i++){
     const entry=entries[i];if(entry._data?.uncompressedSize>100*1048576){skipped++;continue}
     progress(`正在导入 ${i+1} / ${entries.length}：${entry.name}`);
     let data;try{data=await entry.async('uint8array')}catch(e){failed++;firstFailure ||= importError(e);continue}
     await add(entry.name,new Blob([data],{type:mime(entry.name)}));
     if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
   }else if(supported(file.name)){
    await add(file.webkitRelativePath||file.name,new Blob([await file.arrayBuffer()],{type:mime(file.name)}));
   }else if(/\.(rar|7z)$/i.test(file.name)){
    throw Error('暂不支持 RAR 或 7Z。请先解压，再使用“导入文件夹”，或重新压缩为 ZIP。');
   }else skipped++;
  }
  view='all';folder=targetFolder;$('search').value='';$('type').value='';$('sort').value='recent';render();
  const message=`导入完成：新增 ${added} 张图片`+(duplicates?`，${duplicates} 张已在图片库中`:'')+(skipped?`，跳过 ${skipped} 个不支持或过大的文件`:'')+(failed?`，${failed} 张失败：${firstFailure}`:'');
  importNotice(message,failed?'error':'success');toast(message);
  if(added&&navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
 }catch(e){
  if(added){view='all';folder=targetFolder;$('search').value='';$('type').value=''}render();
  const message='导入未完成：'+importError(e)+(added?` 已保留新增的 ${added} 张图片。`:'');
  importNotice(message);toast(message);
 }finally{busy=false;buttons.forEach(id=>$(id).disabled=false);['zipInput','imageInput','folderInput'].forEach(id=>$(id).value='')}
}
function createImageId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 // Web Crypto 的 getRandomValues 在普通 HTTP 页面也可使用。
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
async function saveImage(path,blob,targetFolder=''){
 const destination=targetFolder||(path.includes('/')?path.slice(0,path.lastIndexOf('/')):'');
 if(items.some(x=>x.path===path&&x.blob.size===blob.size&&folderOf(x)===destination))return false;
 const id=createImageId();const x={id,path,folder:destination,name:path.split('/').pop(),blob,added:Date.now(),fav:false};
 await transaction('readwrite',s=>s.put(x));items.push(hydrate(x));return true;
}
function enterFolder(name){folder=name;view='all';$('search').value='';$('type').value='';render()}
function openCreate(){if(busy){toast('请等待导入完成');return}$('folderName').value='';$('folderError').textContent='';$('folderDialog').showModal();$('folderName').focus()}
async function createFolder(name){
 await storageReady;if(!db)throw Error('本地存储不可用，请允许网站存储后重试。');
 name=name.trim();if(!name)throw Error('请输入文件夹名称。');if(name.length>80)throw Error('文件夹名称最多 80 个字符。');if(/[\\/]/.test(name)||name==='.'||name==='..')throw Error('文件夹名称不能包含斜线，也不能是 . 或 ..。');
 if(allFolders().some(p=>p.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('已有同名文件夹，请换一个名称。');
 await transaction('readwrite',store=>store.put({name}),'folders');customFolders.push(name);enterFolder(name);return name;
}
let movingId=null;
function openMove(x){if(busy){toast('请等待导入完成');return}movingId=x.id;$('moveName').textContent=x.name;$('moveError').textContent='';$('moveTarget').replaceChildren(new Option('未分类（移出文件夹）',''),...allFolders().map(p=>new Option(p,p)));$('moveTarget').value=folderOf(x);$('moveDialog').showModal()}
async function moveImage(id,destination){
 const x=items.find(x=>x.id===id);if(!x)throw Error('未找到这张图片。');if(destination&&!allFolders().includes(destination))throw Error('目标文件夹不存在。');
 const {url,...record}=x;await transaction('readwrite',s=>s.put({...record,folder:destination}));x.folder=destination;render();
}
$('newFolder').onclick=openCreate;$('folderScope').onchange=e=>enterFolder(e.target.value);
$('cancelFolder').onclick=()=>$('folderDialog').close();$('cancelMove').onclick=()=>$('moveDialog').close();
$('folderForm').onsubmit=async e=>{e.preventDefault();$('saveFolder').disabled=true;try{const name=await createFolder($('folderName').value);$('folderDialog').close();toast('已新建文件夹：'+name)}catch(e){$('folderError').textContent=e.message}finally{$('saveFolder').disabled=false}};
$('moveForm').onsubmit=async e=>{e.preventDefault();$('saveMove').disabled=true;try{await moveImage(movingId,$('moveTarget').value);$('moveDialog').close();toast('图片已移动')}catch(e){$('moveError').textContent=e.message}finally{$('saveMove').disabled=false}};
function checkInMatches(date){
 const parsed=validDate(date);if(!parsed||parsed.text!==date)return [];
 return items.filter(x=>bookingOf(x).checkIn?.text===date);
}
function deletionGroups(matches){
 const groups=new Map();for(const image of matches){const name=bookingOf(image).name;groups.set(name,(groups.get(name)||0)+1)}
 return [...groups].sort((a,b)=>a[0].localeCompare(b[0],'zh-CN'));
}
let deletePreviewIds=[];
function updateDeletePreview(){
 const matches=checkInMatches($('deleteDate').value),groups=deletionGroups(matches);deletePreviewIds=matches.map(x=>x.id);
 $('deleteSummary').textContent=$('deleteDate').value?`${$('deleteDate').value} 入住 · ${groups.length} 个酒店名称 · ${matches.length} 张图片`:'请选择要删除的完整入住日期。';
 $('deleteList').replaceChildren(...groups.map(([name,count])=>{const row=document.createElement('li');const label=document.createElement('span');label.textContent=name;const amount=document.createElement('b');amount.textContent=count+' 张';row.append(label,amount);return row}));
 $('confirmDeleteDate').disabled=!matches.length;$('confirmDeleteDate').textContent=matches.length?'删除这 '+matches.length+' 张图片':'删除该日期全部图片';$('deleteError').textContent='';
}
async function openDateDelete(){
 if(busy){toast('请等待当前操作完成');return}await storageReady;
 const dates=[...new Set(items.map(x=>bookingOf(x).checkIn?.text).filter(Boolean))].sort().reverse();
 $('deleteDate').replaceChildren(new Option(dates.length?'选择入住日期':'暂无可识别的入住日期',''),...dates.map(date=>new Option(date,date)));
 const query=normalized($('search').value);const parsed=validDate(query);$('deleteDate').value=parsed&&dates.includes(parsed.text)?parsed.text:'';
 updateDeletePreview();$('deleteDialog').showModal();
}
async function deleteCheckInDate(date,expectedIds){
 if(busy)throw Error('正在处理其他操作，请稍后重试。');await storageReady;
 if(busy)throw Error('正在处理其他操作，请稍后重试。');if(!db)throw Error('本地存储不可用，无法删除。');
 if(!validDate(date)||validDate(date).text!==date)throw Error('请选择完整入住日期。');
 const matches=checkInMatches(date),ids=new Set(matches.map(x=>x.id));
 if(!ids.size)throw Error('该入住日期已经没有可删除的图片。');
 if(!expectedIds||expectedIds.length!==ids.size||expectedIds.some(id=>!ids.has(id)))throw Error('匹配图片已变化，请重新查看明细后再删除。');
 busy=true;try{
  await transaction('readwrite',store=>{for(const id of ids)store.delete(id)});
  items=items.filter(x=>!ids.has(x.id));for(const image of matches)URL.revokeObjectURL(image.url);
  render();return matches.length;
 }finally{busy=false}
}
$('deleteByDate').onclick=openDateDelete;$('deleteDate').onchange=updateDeletePreview;$('cancelDeleteDate').onclick=()=>$('deleteDialog').close();
$('deleteForm').onsubmit=async e=>{
 e.preventDefault();const date=$('deleteDate').value,snapshot=[...deletePreviewIds];$('confirmDeleteDate').disabled=true;
 try{const count=await deleteCheckInDate(date,snapshot);$('deleteDialog').close();toast(`已删除 ${date} 入住的 ${count} 张图片（所有文件夹）`)}
 catch(e){updateDeletePreview();$('deleteError').textContent=e.message}
};
function openViewer(i){current=i;$('viewer').showModal();showImage()}
function showImage(){const x=shown[current];if(!x){$('viewer').close();return}$('large').src=x.url;$('large').alt=x.name;$('viewerName').textContent=x.name;$('viewerMeta').textContent=x.path+' · '+size(x.blob.size);$('viewFav').textContent=x.fav?'♥':'♡';$('position').textContent=(current+1)+' / '+shown.length;$('stage').classList.remove('zoomed');$('prev').disabled=$('next').disabled=shown.length<2;$('large').onload=()=>{$('viewerMeta').textContent=x.path+' · '+$('large').naturalWidth+' × '+$('large').naturalHeight+' · '+size(x.blob.size)}}
function move(n){if(!shown.length)return;current=(current+n+shown.length)%shown.length;showImage()}
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('close').onclick=()=>$('viewer').close();$('viewer').addEventListener('close',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})});$('zoom').onclick=()=>$('stage').classList.toggle('zoomed');$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen()}catch{toast('当前浏览器不支持系统全屏，已使用沉浸预览')}};$('viewFav').onclick=()=>toggleFav(shown[current]);$('download').onclick=()=>{const x=shown[current];const a=document.createElement('a');a.href=x.url;a.download=x.name;document.body.append(a);a.click();a.remove()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;folder='';$('search').value='';$('type').value='';render()});['search','type','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));$('density').onclick=()=>$('gallery').classList.toggle('compact');['importTop','importEmpty'].forEach(id=>$(id).onclick=()=>$('imageInput').click());$('chooseZip').onclick=()=>$('zipInput').click();$('chooseFolder').onclick=()=>$('folderInput').click();['zipInput','imageInput','folderInput'].forEach(id=>$(id).onchange=e=>importFiles([...e.target.files]));let dragDepth=0;const drop=$('dropzone');drop.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;drop.classList.add('drag')});drop.addEventListener('dragover',e=>e.preventDefault());drop.addEventListener('dragleave',()=>{if(--dragDepth<=0)drop.classList.remove('drag')});drop.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;drop.classList.remove('drag');importFiles([...e.dataTransfer.files])});window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());document.addEventListener('keydown',e=>{if($('viewer').open){if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1)}else if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('search').focus()}});let touchX;$('stage').addEventListener('touchstart',e=>touchX=e.touches[0].clientX,{passive:true});$('stage').addEventListener('touchend',e=>{if(!$('stage').classList.contains('zoomed')&&Math.abs(e.changedTouches[0].clientX-touchX)>60)move(e.changedTouches[0].clientX<touchX?1:-1)},{passive:true});$('clear').onclick=async()=>{if(busy){toast('请等待当前导入完成');return}if(!items.length){toast('图片库已经是空的');return}if(!confirm('清空当前浏览器中的所有图片和收藏？此操作无法撤销，请确认已保留原图。'))return;try{await transaction('readwrite',s=>s.clear());items.forEach(x=>URL.revokeObjectURL(x.url));items=[];folder='';render();toast('图片库已清空')}catch{toast('清空失败，请重试')}};
storageReady=(async()=>{try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('frame-library',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('images'))r.result.createObjectStore('images',{keyPath:'id'});if(!r.result.objectStoreNames.contains('folders'))r.result.createObjectStore('folders',{keyPath:'name'})};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result)};r.onerror=()=>reject(r.error);r.onblocked=()=>{importNotice('图片库被其他标签页占用，请关闭其他打开此网站的标签页后重试。')}});items=(await load()).map(hydrate);customFolders=await new Promise((resolve,reject)=>{const r=db.transaction('folders').objectStore('folders').getAll();r.onsuccess=()=>resolve(r.result.map(x=>x.name));r.onerror=()=>reject(r.error)});render()}catch{toast('无法访问本地存储，请使用普通浏览器窗口并允许网站存储');render()}})();
