(function(){
  const LOCAL_KEY='loadwise.v3.projects',cfg=window.LOADWISE_SUPABASE||{},configured=Boolean(cfg.url&&cfg.publishableKey&&window.supabase),client=configured?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
  let user=null,currentId=null,suggestedName='',suppressDirty=false,dirty=false,saving=false,saveAsNew=false;
  const $=id=>document.getElementById(id);
  function readLocal(){
    const raw=localStorage.getItem(LOCAL_KEY);
    if(!raw)return[];
    const rows=JSON.parse(raw);
    if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.id!=='string'||typeof row.name!=='string'||!row.payload||typeof row.payload!=='object'))throw new Error('브라우저 저장 데이터 형식이 올바르지 않습니다. 기존 데이터는 그대로 보존했습니다.');
    return rows;
  }
  const writeLocal=rows=>localStorage.setItem(LOCAL_KEY,JSON.stringify(rows));
  function state(text,tone=''){const el=$('saveState');el.textContent=text;el.dataset.tone=tone}
  function showCurrent(name='저장되지 않음'){suggestedName=name==='저장되지 않음'?suggestedName:name;$('currentProjectName').textContent=name;$('projectName').value=name==='저장되지 않음'?'':name}
  function markDirty(){if(!suppressDirty){dirty=true;state('저장되지 않음','dirty')}}
  function suggestName(name){if(!currentId&&name&&$('currentProjectName').textContent==='저장되지 않음')suggestedName=name.trim()}
  function snapshot(){return window.loadwiseProject.snapshot()}
  function record(name,id=currentId){return{id:id||crypto.randomUUID(),name,payload:snapshot(),updated_at:new Date().toISOString()}}
  async function list(){if(user){const{data,error}=await client.from('projects').select('id,name,payload,updated_at').order('updated_at',{ascending:false});if(error)throw error;return data}return readLocal().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))}
  function requireLogin(){if(configured&&!user){$('accountDialog').showModal();return true}return false}
  function showSaveDialog(name){$('saveNameInput').value=name;$('saveDialog').showModal();setTimeout(()=>$('saveNameInput').select(),0)}
  function requestSave(){if(requireLogin()||saving)return;saveAsNew=false;if(currentId){if(confirm('현재 프로젝트에 저장할까요?'))save($('projectName').value);return}saveAsNew=true;showSaveDialog(suggestedName||`적재 계획 ${new Date().toLocaleDateString('ko-KR')}`)}
  function requestSaveAs(){if(requireLogin()||saving)return;saveAsNew=true;showSaveDialog(currentId?`${$('projectName').value} 복사본`:suggestedName||`적재 계획 ${new Date().toLocaleDateString('ko-KR')}`)}
  async function save(name){
    name=name.trim();if(!name)return alert('저장 이름을 입력해 주세요.');if(name.length>80)return alert('저장 이름은 80자 이내로 입력해 주세요.');
    saving=true;$('saveProject').disabled=true;$('saveAsProject').disabled=true;$('confirmSave').disabled=true;state('저장 중…');
    try{
      if(user){const row={...(!saveAsNew&&currentId?{id:currentId}:{}),user_id:user.id,name,payload:snapshot(),updated_at:new Date().toISOString()},{data,error}=await client.from('projects').upsert(row).select('id').single();if(error)throw error;currentId=data.id}
      else{const rows=readLocal(),next=record(name,saveAsNew?null:currentId),index=rows.findIndex(x=>x.id===next.id);if(index>=0)rows[index]=next;else rows.push(next);writeLocal(rows);currentId=next.id}
      showCurrent(name);$('saveDialog').close();dirty=false;state('저장됨','saved');
    }catch(error){console.error(error);state('저장 실패','error');alert(`저장하지 못했습니다. ${error.message}`)}
    finally{saving=false;saveAsNew=false;$('saveProject').disabled=false;$('saveAsProject').disabled=false;$('confirmSave').disabled=false}
  }
  async function openList(){
    if(requireLogin())return;
    try{
      const rows=await list(),el=$('projectList');
      $('projectsDescription').textContent=user?'내 계정에 저장된 적재 프로젝트입니다.':'이 브라우저에 저장된 적재 프로젝트입니다.';
      el.innerHTML=rows.length?rows.map(row=>`<article><button class="project-open" data-open="${escapeHtml(row.id)}"><strong>${escapeHtml(row.name)}</strong><small>${formatDate(row.updated_at)}</small></button><button class="project-delete" data-delete-project="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.name)} 삭제">삭제</button></article>`).join(''):'<p class="empty-projects">아직 저장된 프로젝트가 없습니다.</p>';
      el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open));el.querySelectorAll('[data-delete-project]').forEach(b=>b.onclick=()=>remove(b.dataset.deleteProject));
      if(!$('projectsDialog').open)$('projectsDialog').showModal();
    }catch(error){alert(`저장 목록을 불러오지 못했습니다. ${error.message}`)}
  }
  async function open(id){
    if(dirty&&!confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 불러올까요?'))return;
    try{const row=(await list()).find(x=>x.id===id);if(!row)return;suppressDirty=true;window.loadwiseProject.apply(row.payload);suppressDirty=false;currentId=row.id;showCurrent(row.name);$('projectsDialog').close();dirty=false;state('저장됨','saved')}
    catch(error){suppressDirty=false;alert(`프로젝트를 불러오지 못했습니다. ${error.message}`)}
  }
  async function remove(id){
    if(!confirm('이 저장을 삭제할까요?'))return;
    try{if(user){const{error}=await client.from('projects').delete().eq('id',id);if(error)throw error}else writeLocal(readLocal().filter(x=>x.id!==id));if(currentId===id){currentId=null;showCurrent();dirty=true;state('저장되지 않음','dirty')}await openList()}
    catch(error){alert(`삭제하지 못했습니다. ${error.message}`)}
  }
  function fresh(force=false){if(!force&&dirty&&!confirm('저장하지 않은 변경사항을 지우고 새 프로젝트를 시작할까요?'))return;suppressDirty=true;window.loadwiseProject.reset();suppressDirty=false;currentId=null;suggestedName='';showCurrent();$('projectsDialog').close();dirty=false;state('저장되지 않음')}
  async function emailLogin(){if(!configured)return;const email=$('loginEmail').value.trim();if(!email)return alert('이메일을 입력해 주세요.');const{error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});$('authMessage').textContent=error?error.message:'이메일로 로그인 링크를 보냈습니다.'}
  async function logout(){await client?.auth.signOut()}
  function renderAccount(){const signed=Boolean(user);$('accountButton').hidden=!configured;$('localNotice').hidden=configured;$('signedOutPanel').hidden=signed;$('signedInPanel').hidden=!signed;$('accountButton').textContent=signed?'내 계정':'로그인';$('accountEmail').textContent=user?.email||'로그인 사용자'}
  function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'저장 날짜 없음':date.toLocaleString('ko-KR')}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
  async function init(){
    $('saveProject').onclick=requestSave;$('saveAsProject').onclick=requestSaveAs;$('confirmSave').onclick=()=>save($('saveNameInput').value);$('saveNameInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save(e.currentTarget.value)}};$('openProjects').onclick=openList;$('newProjectTop').onclick=()=>fresh();$('accountButton').onclick=()=>$('accountDialog').showModal();$('emailLogin').onclick=emailLogin;$('logoutButton').onclick=logout;$('containerType').addEventListener('change',markDirty);$('optimization').addEventListener('change',markDirty);
    if(client){const{data}=await client.auth.getSession();user=data.session?.user||null;client.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(user?.id&&user.id!==next?.id)fresh(true);user=next;renderAccount()})}
    renderAccount();showCurrent();state('저장되지 않음');
  }
  window.loadwiseStorage={markDirty,suggestName};window.addEventListener('DOMContentLoaded',init);
})();
