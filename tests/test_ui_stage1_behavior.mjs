import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const studio=readFileSync(new URL('../assets/production-studio.js',import.meta.url),'utf8');
const start=studio.indexOf(' const projectTabs=[');
const end=studio.indexOf(' async function recentProjects()',start);
assert.ok(start>=0&&end>start,'Project Manager controller functions must exist');
const fragment=studio.slice(start,end);
const nodes=new Map();
for(const id of ['projTabProjects','projTabRecovery','projTabTemplates','projPanelProjects','projPanelRecovery','projPanelTemplates']){
 const classes=new Set();
 const node={
  hidden:false,tabIndex:-1,attrs:{},focusCount:0,
  classList:{toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}},
  setAttribute(name,value){node.attrs[name]=value;},
  focus(){node.focusCount++;},
  get active(){return classes.has('active');}
 };
 nodes.set(id,node);
}
const lookup=id=>{const result=nodes.get(id);if(!result)throw Error('Unexpected UI element '+id);return result;};
const {setProjectManagerTab,bindProjectManagerTabs}=new Function('$',fragment+'\nreturn {setProjectManagerTab,bindProjectManagerTabs};')(lookup);
bindProjectManagerTabs();
const tabs=['projTabProjects','projTabRecovery','projTabTemplates'],panels=['projPanelProjects','projPanelRecovery','projPanelTemplates'];
function expectActive(index){
 for(let i=0;i<tabs.length;i++){
  assert.equal(lookup(tabs[i]).attrs['aria-selected'],String(i===index),'tab accessibility state');
  assert.equal(lookup(tabs[i]).active,i===index,'active class');
  assert.equal(lookup(tabs[i]).tabIndex,i===index?0:-1,'roving keyboard tab index');
  assert.equal(lookup(panels[i]).hidden,i!==index,'only one panel visible');
 }
}
setProjectManagerTab('projects');expectActive(0);
lookup(tabs[1]).onclick();expectActive(1);
const event=key=>({key,prevented:false,preventDefault(){this.prevented=true;}});
let e=event('ArrowRight');lookup(tabs[1]).onkeydown(e);assert.equal(e.prevented,true);expectActive(2);
e=event('ArrowRight');lookup(tabs[2]).onkeydown(e);expectActive(0);
e=event('ArrowLeft');lookup(tabs[0]).onkeydown(e);expectActive(2);
e=event('Home');lookup(tabs[2]).onkeydown(e);expectActive(0);
e=event('End');lookup(tabs[0]).onkeydown(e);expectActive(2);
assert.ok(lookup(tabs[0]).focusCount>0);
assert.ok(lookup(tabs[2]).focusCount>0);
e=event('Escape');lookup(tabs[2]).onkeydown(e);assert.equal(e.prevented,false);expectActive(2);
setProjectManagerTab('recovery');expectActive(1);
setProjectManagerTab('does-not-exist');expectActive(0);
console.log('UI STAGE 1 BEHAVIOR PASS: tab visibility, clicks, keyboard wrapping and ARIA state');
