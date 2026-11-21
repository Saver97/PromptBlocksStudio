'use strict';
const Blocks = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const roles = ['自由补充','公共基础','角色','服装','场景','光照','画师串','负面约束','完整组合'];
  const newBandCharacters = [
    {label:'椎名立希',name:'Shiina Taki',band:'mygo!!!!!',features:[['long straight dark brown hair','深棕色长直发'],['violet eyes','紫罗兰色眼睛'],['asymmetrical earrings','不对称耳饰']]},
    {label:'高松灯',name:'Takamatsu Tomori',band:'mygo!!!!!',features:[['short muted ash-purple bob cut','灰紫色短波波头'],['rose-brown eyes','粉棕色眼睛']]},
    {label:'千早爱音',name:'Chihaya Anon',band:'mygo!!!!!',features:[['long straight pink hair','粉色长直发'],['grey-blue eyes','灰蓝色眼睛']]},
    {label:'要乐奈',name:'Kaname Raana',band:'mygo!!!!!',features:[['short silver-white bob cut','银白色短波波头'],['heterochromia','异色瞳'],['yellow right eye','本人右眼金黄'],['blue left eye','本人左眼蓝色']]},
    {label:'三角初华',name:'Misumi Uika',band:'ave mujica',features:[['shoulder-length pale blonde hair','齐肩浅金发'],['violet eyes','紫罗兰色眼睛']]},
    {label:'祐天寺喵梦',name:'Yuutenji Nyamu',band:'ave mujica',features:[['short purple bob cut','紫色短波波头'],['reddish pink eyes','玫红色眼睛']]}
  ];
  // Bilingual shape and colour cues for the default portrait of each character.
  const franchiseGroups = [
    {group:"绝区零", tag:"zenless zone zero", members:[
      {label:"妮可", name:"Nicole Demara", features:[["long pink hair tied up at both sides", "两侧束起的粉色长发"], ["light green eyes", "浅绿眼睛"], ["black hair clips", "黑色发夹"], ["playful self-assured gaze", "俏皮自信的眼神"]]},
      {label:"朱鸢", name:"Zhu Yuan", features:[["black ponytail", "黑色马尾"], ["orange streak in bangs", "橙色挑染刘海"], ["amber-red eyes", "琥珀红眼睛"], ["upright athletic stance", "挺拔矫健的站姿"]]},
      {label:"简", name:"Jane Doe", features:[["short black bob", "黑色短波波头"], ["teal eyes", "青绿眼睛"], ["rounded rat ears", "圆形鼠耳"], ["sly half-smile", "带着狡黠笑意的神态"]]},
      {label:"耀嘉音", name:"Astra Yao", features:[["long black hair", "黑色长发"], ["blunt bangs", "齐刘海"], ["magenta eyes", "玫红眼睛"], ["poised stage presence", "从容的舞台仪态"]]},
      {label:"伊芙琳", name:"Evelyn Chevalier", features:[["long blonde ponytail", "金色长马尾"], ["side-swept bangs", "斜刘海"], ["violet eyes", "紫色眼睛"], ["composed athletic bearing", "冷静利落的体态"]]},
      {label:"仪玄", name:"Yixuan", features:[["long silver-white hair", "银白长发"], ["golden eyes", "金色眼睛"], ["black forehead ornament", "黑色额饰"], ["relaxed upright posture", "松弛挺拔的身姿"]]},
    ]},
    {group:"原神", tag:"genshin impact", members:[
      {label:"刻晴", name:"Keqing", features:[["long lavender twintails", "淡紫色双马尾"], ["pointed twin hair buns", "尖角形双发髻"], ["amethyst eyes", "紫晶色眼睛"], ["alert focused gaze", "专注警觉的目光"]]},
      {label:"甘雨", name:"Ganyu", features:[["long pale blue hair", "浅蓝长发"], ["black horns with red markings", "带红纹的黑色双角"], ["violet eyes", "紫色眼睛"], ["gentle reserved expression", "温和内敛的神态"]]},
      {label:"琴", name:"Jean Gunnhildr", features:[["high blonde ponytail", "金色高马尾"], ["blue-grey eyes", "灰蓝色眼睛"], ["upright knightly bearing", "挺拔的骑士仪态"]]},
      {label:"优菈", name:"Eula Lawrence", features:[["layered pale blue hair", "层次分明的浅蓝发"], ["purple and gold gradient eyes", "紫金渐变眼睛"], ["black headband", "黑色发箍"], ["graceful dancer-like posture", "舒展的舞者身姿"]]},
      {label:"雷电将军", name:"Raiden Shogun", features:[["long violet braid", "紫色长辫"], ["violet eyes", "紫色眼睛"], ["beauty mark under the right eye", "本人右眼下的泪痣"], ["calm commanding gaze", "平静而有威严的目光"]]},
      {label:"八重神子", name:"Yae Miko", features:[["long pink hair", "粉色长发"], ["drooping fox ears", "下垂的狐耳"], ["violet eyes", "紫色眼睛"], ["knowing smile", "含着笑意的从容神态"]]},
    ]},
    {group:"崩坏3", tag:"honkai impact 3rd", members:[
      {label:"琪亚娜 · 早期", name:"Kiana Kaslana", features:[["white twin braids", "白色双麻花辫"], ["bright blue eyes", "亮蓝色眼睛"], ["lively athletic bearing", "轻快矫健的体态"]]},
      {label:"琪亚娜 · 终焉之律者", name:"Kiana Kaslana", form:"herrscher of finality", features:[["long flowing white hair with a curled forelock", "白色披肩长发与弯翘额发"], ["blue-violet eyes with diamond pupils", "带菱形瞳孔的蓝紫眼睛"], ["serene confident gaze", "从容坚定的目光"]]},
      {label:"琪亚娜 · 后崩坏书", name:"Kiana Kaslana", form:"a post-honkai odyssey", features:[["long white ponytail with violet streaks", "带紫色挑染的白色长马尾"], ["blue eyes", "蓝色眼睛"], ["mature athletic silhouette", "成熟矫健的身形"], ["calm warm gaze", "沉稳温和的目光"]]},
      {label:"雷电芽衣 · 雷之律者", name:"Raiden Mei", form:"herrscher of thunder", features:[["long dark purple hair and straight bangs", "深紫长发与齐刘海"], ["paired crimson horns", "一对绯红色的角"], ["violet-red eyes", "紫红色眼睛"], ["stern composed gaze", "沉静凌厉的目光"]]},
      {label:"雷电芽衣 · 后崩坏书", name:"Raiden Mei", form:"a post-honkai odyssey", migration:"postHonkaiMei20261119", features:[["long loose indigo hair with level bangs", "自然披散的靛紫长直发与平齐刘海"], ["violet eyes", "紫色眼睛"], ["a white feather earring on the right ear", "本人右耳单侧白羽耳坠"], ["calm mature poise", "成熟沉静的仪态"]]},
      {label:"无量塔姬子", name:"Murata Himeko", features:[["long crimson hair", "绯红长发"], ["golden eyes", "金色眼睛"], ["loosely tied hair", "松松束起的头发"], ["confident mature bearing", "成熟自信的仪态"]]},
      {label:"布洛妮娅 · 早期", name:"Bronya Zaychik", features:[["silver-grey twin drill curls", "银灰色双螺旋卷发"], ["grey eyes", "灰色眼睛"], ["petite build and a reserved expression", "娇小身形与内敛神情"]]},
      {label:"布洛妮娅 · 次生银翼", name:"Bronya Zaychik", form:"silverwing: n-ex", features:[["long flowing silver-grey hair", "披散的银灰长发"], ["grey eyes", "灰色眼睛"], ["composed adult face", "沉静的成年面容"], ["tall poised silhouette", "高挑挺拔的身形"]]},
      {label:"德丽莎", name:"Theresa Apocalypse", features:[["long white hair", "白色长发"], ["blue eyes", "蓝色眼睛"], ["side-swept fringe", "斜分刘海"], ["petite stature", "娇小身形"]]},
    ]},
    {group:"崩坏·星穹铁道", tag:"honkai: star rail", members:[
      {label:"姬子", name:"Himeko", features:[["long wavy red hair", "红色波浪长发"], ["golden eyes", "金色眼睛"], ["long side-swept bangs", "长斜刘海"], ["composed mature bearing", "从容成熟的仪态"]]},
      {label:"三月七", name:"March 7th", features:[["shoulder-length pink hair", "齐肩粉发"], ["pink and blue gradient eyes", "粉蓝渐变眼睛"], ["bright cheerful expression", "开朗明快的神情"]]},
      {label:"卡芙卡", name:"Kafka", features:[["wine-red ponytail", "酒红色马尾"], ["pinkish violet eyes", "粉紫色眼睛"], ["sunglasses on head", "头顶墨镜"], ["relaxed confident bearing", "松弛自信的仪态"]]},
    ]},
    {group:"VOCALOID", tag:"vocaloid", members:[
      {label:"初音未来", name:"Hatsune Miku", features:[["long turquoise twintails", "青绿色长双马尾"], ["teal eyes", "青绿眼睛"], ["rectangular hair ties", "方框形发饰"], ["lively slender silhouette", "轻盈纤细的身形"]]},
    ]},
    {group:"Re:从零开始的异世界生活", tag:"re:zero kara hajimeru isekai seikatsu", members:[
      {label:"蕾姆", name:"Rem", features:[["short blue bob", "蓝色短波波头"], ["bangs covering the right eye", "刘海遮住本人右眼"], ["blue eyes", "蓝色眼睛"], ["gentle attentive gaze", "温柔专注的眼神"]]},
      {label:"拉姆", name:"Ram", features:[["short pink bob", "粉色短波波头"], ["bangs covering the left eye", "刘海遮住本人左眼"], ["red eyes", "红色眼睛"], ["cool self-possessed gaze", "冷静自持的目光"]]},
    ]},
  ];
  const characterPresets = [
    {label:'示例角色 Alice',group:'通用示例',shortName:'Alice',name:'Alice',identityTags:'',gender:'female',sourceDescription:'成年女性，黑色短发、棕色眼睛',description:'an adult woman with short black hair and brown eyes'},
    {label:'示例角色 Betty',group:'通用示例',shortName:'Betty',name:'Betty',identityTags:'',gender:'female',sourceDescription:'成年女性，棕色长发、蓝色眼睛',description:'an adult woman with long brown hair and blue eyes'},
    {label:'丰川祥子',shortName:'Sakiko',group:'Ave Mujica',name:'Togawa Sakiko',identityTags:'togawa sakiko, bang dream!',gender:'female',sourceDescription:'浅蓝色长发、金色眼睛、黑色发带',description:'long light blue hair, golden eyes, and black hair ribbons'},
    {label:'长崎素世',shortName:'Soyo',group:'MyGO!!!!!',name:'Nagasaki Soyo',identityTags:'nagasaki soyo, bang dream!',gender:'female',sourceDescription:'浅棕色波浪长发、浅蓝色眼睛',description:'long light brown wavy hair and light blue eyes'},
    {label:'若叶睦',shortName:'Mutsumi',group:'Ave Mujica',name:'Wakaba Mutsumi',identityTags:'wakaba mutsumi, bang dream!',gender:'female',sourceDescription:'浅薄荷绿长发、浅金色眼睛',description:'long pale mint green hair and pale gold eyes'},
    {label:'八幡海玲',shortName:'Umiri',group:'Ave Mujica',name:'Yahata Umiri',identityTags:'yahata umiri, bang dream!',gender:'female',sourceDescription:'深灰色头发、紫色发梢、蓝色眼睛',description:'dark grey hair with violet tips and blue eyes'}
  ];
  function addPreset(c, group, identity, shortName) {
    const preset = {label:c.label, name:c.name, group, gender:'female',
      identityTags:identity.map(([text])=>text).join(', '),
      sourceDescription:c.features.map(([,zh])=>zh).join('、'),
      description:c.features.map(([en])=>en).join(', ')};
    if(shortName)preset.shortName=shortName;
    characterPresets.push(preset);
    return {label:c.label, entries:[...identity,...c.features]};
  }
  const originalBandFeatures = [
    ['丰川祥子', [['long light blue hair','浅蓝色长发'],['golden eyes','金色眼睛'],['black hair ribbons','黑色发带']]],
    ['长崎素世', [['long light brown wavy hair','浅棕色波浪长发'],['light blue eyes','浅蓝色眼睛']]],
    ['若叶睦', [['long pale mint green hair','浅薄荷绿长发'],['pale gold eyes','浅金色眼睛']]],
    ['八幡海玲', [['dark grey hair','深灰色头发'],['violet hair tips','紫色发梢'],['blue eyes','蓝色眼睛']]]
  ];
  const originalBandTemplates = originalBandFeatures.map(([label, features]) => {
    const preset = characterPresets.find(p => p.label === label);
    return {label, entries: [[preset.name.toLowerCase(), label], ['bang dream!', 'BanG Dream!'],
      [preset.group.toLowerCase(), preset.group], ...features]};
  });
  const bandTemplates = newBandCharacters.map(c=>{
    const group=c.band==='mygo!!!!!'?'MyGO!!!!!':'Ave Mujica';
    return addPreset(c,group,[[c.name.toLowerCase(),c.label],['bang dream!','BanG Dream!'],[c.band,group]],c.name.split(' ')[1]);
  });
  const franchiseTemplateBatches=new Map();
  for(const {group,tag,members} of franchiseGroups){
    for(const c of members){
      const identity=[[c.name.toLowerCase(),c.label],[tag,group]];
      if(c.form)identity.push([c.form,c.label.split(' · ')[1]]);
      const migration=c.migration || 'franchisePresets20261119';
      if(!franchiseTemplateBatches.has(migration))franchiseTemplateBatches.set(migration,[]);
      franchiseTemplateBatches.get(migration).push(addPreset(c,group,identity));
    }
  }
  function installPresets(state, migration, templates) {
    if(state.migrations?.[migration])return;
    for(const {label,entries} of templates){
      if(state.templates.some(t=>t.role==='角色'&&t.name===label))continue;
      state.templates.push({id:id(),name:label,role:'角色',weight:1,negative:[],
        positive:entries.map(([text,label])=>({text,label,enabled:true,weight:1}))});
    }
    state.migrations={...state.migrations,[migration]:true};
  }
  function installBandTemplates(state){
    installPresets(state,'bandPresets20261119',bandTemplates);
  }
  function installCharacterTemplates(state){
    installPresets(state,'originalBandCharacterTemplates',originalBandTemplates);
    installBandTemplates(state);
    for(const [key,templates] of franchiseTemplateBatches)installPresets(state,key,templates);
  }
  function upgradeCharacters(list) {
    // Upgrade only untouched built-in identities; preserve custom names and appearance.
    return (list||[]).map(c=>{const preset=characterPresets.find(x=>x.shortName===c.name&&x.description===c.description);
      return preset&&c.identityTags===undefined?{...c,name:preset.name,identityTags:preset.identityTags,gender:c.gender??preset.gender}:copy(c);});
  }
  function identityTokens(c) {return (c.identityTags||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);}
  function proseWarnings(text,characters,source='') {
    const used=[...new Set(aliases(text))].map(a=>(characters||[]).find(c=>c.alias===a)).filter(Boolean),warnings=[];
    if(used.length&&used.every(c=>c.gender==='female')&&/\b(he|him|his|himself)\b/i.test(text))warnings.push('引用的角色均设为女性，但译文出现 he / him / his，请核对指代；不会自动替换。');
    if(used.length>1&&/\b(she|her|hers|he|him|his|they|their)\b/i.test(text))warnings.push('多人描述中含代词，可能指代不清。动作主体、接触对象建议直接写 {{A}} / {{B}}。');
    if(/\breached? out to the (left|right) hand\b/i.test(text))warnings.push('“reach out to the … hand”可能把“伸出自己的手”译成“伸向另一只手”，请核对动作。');
    if(used.length>1&&/牵|握|\b(hold|holds|holding|held)\b/i.test(source+' '+text)&&/手|\bhands?\b/i.test(source+' '+text)&&!/另一只手|其余.*手|剩下.*手|\b(other|remaining|free)(?: left| right)? hands?\b/i.test(source+' '+text))warnings.push('牵手描述可补充其余手的位置，减少模型自由发挥；这只是检查提示。');
    return warnings;
  }
  function block(name='自由补充', role='自由补充', positive=[], negative=[]) {
    return {id:id(),name,role,enabled:true,weight:1,collapsed:false,positive:copy(positive),negative:copy(negative)};
  }
  function seedValue(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) <= 18446744073709551615n) return value;
    throw Error('种子须为 0～18446744073709551615 的整数，大整数请用十进制字符串');
  }
  function schemeSeeds(parameters = {}) {
    const seeds = parameters.seed == null ? [] : [parameters.seed];
    if (parameters.extra_seeds === undefined) return seeds;
    if (!Array.isArray(parameters.extra_seeds)) throw Error('附加种子需要填写为数组');
    return seeds.concat(parameters.extra_seeds.map(seedValue));
  }
  function scheme(name='新方案') {return {id:id(),name,blocks:[block()],characters:[],parameters:{},models:{},notes:''};}
  function prose(name='自然语言描述') {return {...block(name),kind:'prose',positiveText:'',negativeText:'',positiveSource:'',negativeSource:''};}
  const aliases = text => [...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,15})\s*\}\}/g)].map(m=>m[1].toUpperCase());
  function validateCharacters(list) {if(list===undefined)return;if(!Array.isArray(list))throw Error('角色定义格式无效');const used=new Set();for(const c of list){if(!c||typeof c.alias!=='string'||!/^[A-Z][A-Z0-9_]{0,15}$/.test(c.alias)||used.has(c.alias)||typeof c.name!=='string'||!c.name.trim()||typeof c.description!=='string'||typeof (c.sourceDescription??'')!=='string'||typeof (c.translatedFrom??'')!=='string'||typeof (c.identityTags??'')!=='string'||!['unknown','female','male','other'].includes(c.gender??'unknown')||/[{}]/.test(c.name+c.description+(c.identityTags||'')))throw Error('角色代号必须唯一，名字、身份标签和描述不能嵌套变量，性别选项须有效');used.add(c.alias);}}
  function languageFields(b) {return {kind:b.kind||'tags',positiveText:b.positiveText||'',negativeText:b.negativeText||'',positiveSource:b.positiveSource||'',negativeSource:b.negativeSource||'',positiveTranslatedFrom:b.positiveTranslatedFrom||'',negativeTranslatedFrom:b.negativeTranslatedFrom||''};}
  function validate(s) {
    if(s?.theme!==undefined&&!['forest','midnight','violet','ember','paper','mist'].includes(s.theme))throw Error('未知配色');
    if(!s || s.version!==2 || !Array.isArray(s.schemes) || !s.schemes.length || !Array.isArray(s.templates) || !Array.isArray(s.favorites) || !['comfy','nai','plain'].includes(s.format)) throw Error('不是有效的分块版工作区');
    const ids=new Set();
    function identity(x){if(!x || typeof x.id!=='string' || !x.id || ids.has(x.id) || typeof x.name!=='string' || !x.name.trim())throw Error('名称或编号无效、重复');ids.add(x.id);}
    function tokens(items){if(!Array.isArray(items)||items.some(t=>!t||typeof t.text!=='string'||!t.text.trim()||typeof t.label!=='string'||!Number.isFinite(t.weight)||Math.abs(t.weight)>20||typeof t.enabled!=='boolean'))throw Error('词条或权重无效');}
    function content(b){tokens(b.positive);tokens(b.negative);if(!roles.includes(b.role))throw Error('未知内容块类型');if(b.kind!==undefined&&!['tags','prose'].includes(b.kind))throw Error('未知内容格式');for(const key of ['positiveText','negativeText','positiveSource','negativeSource','positiveTranslatedFrom','negativeTranslatedFrom'])if(b[key]!==undefined&&typeof b[key]!=='string')throw Error('自然语言内容格式无效');if(b.kind==='prose'&&(b.positive.length||b.negative.length))throw Error('自然语言块不能混入拆分标签');validateCharacters(b.characters);}
    for(const p of s.schemes){identity(p);if(!Array.isArray(p.blocks))throw Error('方案内容无效');for(const b of p.blocks){identity(b);content(b);if(typeof b.enabled!=='boolean'||typeof b.collapsed!=='boolean'||!Number.isFinite(b.weight)||Math.abs(b.weight)>20)throw Error('块状态或权重无效');}if(p.parameters!=null&&(typeof p.parameters!=='object'||Array.isArray(p.parameters)))throw Error('参数格式无效');}
    for(const p of s.schemes){validateCharacters(p.characters);for(const key of ['autoIntroduce','autoIdentity'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('角色自动补充开关无效');}
    for(const t of s.templates){identity(t);content(t);if(t.weight!==undefined&&(!Number.isFinite(t.weight)||Math.abs(t.weight)>20))throw Error('组合块权重无效');}
    if(!s.schemes.some(p=>p.id===s.activeSchemeId)||s.favorites.some(f=>typeof f!=='string'))throw Error('当前方案或收藏无效');
    for (const item of [...s.schemes, ...s.templates]) {
      if (item.parameters?.extra_seeds !== undefined) schemeSeeds(item.parameters);
    }
    const upgraded=copy(s);for(const p of [...upgraded.schemes,...upgraded.templates]){if(p.characters)p.characters=upgradeCharacters(p.characters);for(const b of p.blocks||[])if(b.characters)b.characters=upgradeCharacters(b.characters);}return upgraded;
  }
  function fromTemplate(t) {return {...block(t.name,t.role,t.positive,t.negative),...languageFields(t),weight:t.weight??1,sourceTemplateId:t.id,recipe:t.recipe||''};}
  function duplicate(b) {return {...copy(b),id:id(),name:b.name+' · 副本'};}
  function assemble(p,format='comfy',raw=false) {
    const result={positive:'',negative:'',warnings:[],errors:[],counts:{positive:0,negative:0},paragraphs:{positive:0,negative:0},sources:{positive:[],negative:[]}};
    for(const side of ['positive','negative']) {
      const seen=new Map(),out=[];
      for(const b of p.blocks.filter(b=>b.enabled))for(const t of b[side].filter(t=>t.enabled)) {
        const w=Number((t.weight*b.weight).toFixed(6)),key=norm(t.text),existing=seen.get(key)||[];
        if(existing.some(x=>x.weight!==w))result.warnings.push(`${side==='positive'?'正面':'负面'}重复词「${t.text}」权重不同：${existing.map(x=>x.block+' ×'+x.weight).join('、')} / ${b.name} ×${w}；已保留两处，请自行调整。`);
        if(existing.some(x=>x.weight===w)) {result.sources[side].find(x=>x.key===key&&x.weight===w).blocks.push(b.name);continue;}
        const text=format==='plain'||w===1?t.text:format==='nai'?`${w}::${t.text}::`:`(${t.text}:${w})`;
        out.push(text);existing.push({weight:w,block:b.name});seen.set(key,existing);
        result.sources[side].push({key,text:t.text,weight:w,blocks:[b.name]});
      }
      result[side]=out.join(', ');result.counts[side]=out.length;
    }
    const pos=new Set(result.sources.positive.map(x=>x.key)),neg=new Set(result.sources.negative.map(x=>x.key));
    for(const t of pos)if(neg.has(t))result.warnings.push(`「${t}」同时出现在正面和负面，请检查用途。`);
    if(pos.has('solo')&&(pos.has('2girls')||pos.has('2boys')||pos.has('multiple girls')))result.warnings.push('solo 与多人标签同时启用，请检查人数设定。');
    if(pos.has('1girl')&&pos.has('2girls'))result.warnings.push('1girl 与 2girls 同时启用，请检查人数设定。');
    const chars=new Map((p.characters||[]).map(c=>[c.alias,c])),used=new Set();
    for(const side of ['positive','negative']) {
      const paragraphs=[];
      for(const b of p.blocks.filter(b=>b.enabled&&b.kind==='prose')) {
        const source=b[side+'Source']||'',text=b[side+'Text']||'';
        if(source.trim()&&!text.trim())result.errors.push(`「${b.name}」${side==='positive'?'正面':'负面'}尚未翻译。`);
        if(source.trim()&&text.trim()&&b[side+'TranslatedFrom']!==source)result.errors.push(`「${b.name}」中文已修改，请更新对应英文。`);
        if(!text.trim())continue;
        for(const warning of proseWarnings(text,p.characters,source))result.warnings.push(`「${b.name}」${warning}`);
        if(source.trim()&&JSON.stringify(aliases(source).sort())!==JSON.stringify(aliases(text).sort()))result.errors.push(`「${b.name}」中英文的角色代号不一致，请检查译文。`);
        const expanded=raw?text:text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,15})\s*\}\}/g,(match,key)=>{const alias=key.toUpperCase(),c=chars.get(alias);if(!c){result.errors.push(`未定义角色 {{${alias}}}（${b.name}）`);return match;}if(side==='positive')used.add(alias);return c.name;});
        if(!raw&&/[{}]/.test(expanded))result.errors.push(`「${b.name}」存在未展开的占位符，请使用 {{A}} 这类格式。`);
        paragraphs.push(expanded.trim());result.sources[side].push({key:'prose:'+b.id,text:expanded,weight:1,blocks:[b.name],kind:'prose'});
      }
      result.paragraphs[side]=paragraphs.length;
      const introductions=[];
      if(!raw&&side==='positive'&&p.autoIdentity!==false){
        const added=[];
        for(const alias of used){const c=chars.get(alias),tags=identityTokens(c);if(!tags.length)result.warnings.push(`角色 ${alias}（${c.name}）未填写身份标签；原创角色可留空，已有角色建议补全姓名与作品标签。`);
          for(const text of tags){const key=norm(text);const existing=result.sources.positive.find(x=>x.key===key);if(existing){if(!existing.blocks.includes('角色 '+alias))existing.blocks.push('角色 '+alias);continue;}
            added.push(text);result.sources.positive.push({key,text,weight:1,blocks:['角色 '+alias]});result.counts.positive++;if(neg.has(key))result.warnings.push(`身份标签「${text}」同时出现在负面，请检查用途。`);
          }
        }
        result.positive=[result.positive,...added].filter(Boolean).join(', ');
      }
      if(!raw&&side==='positive'&&p.autoIntroduce!==false)for(const alias of used){const c=chars.get(alias);if(c.sourceDescription?.trim()&&(!c.description.trim()||c.translatedFrom!==c.sourceDescription))result.errors.push(`角色 ${alias} 的中文外貌尚未翻译或已修改。`);if(c.description.trim())introductions.push(`${c.name}: ${c.description.trim()}${/[.!?。！？]$/.test(c.description.trim())?'':'.'}`);}
      result[side]=[result[side],...introductions,...paragraphs].filter(Boolean).join('\n\n');
    }
    result.warnings=[...new Set(result.warnings)];result.errors=[...new Set(result.errors)];return result;
  }
  function importLegacy(old) {
    if(!old||old.version!==1||!Array.isArray(old.presets)||!Array.isArray(old.positive)||!Array.isArray(old.negative))throw Error('不是旧版工作区');
    const p=scheme('旧版当前方案');p.blocks=[block('旧版当前提示词','自由补充',old.positive,old.negative)];
    const s={version:2,activeSchemeId:p.id,schemes:[p],templates:old.presets.map(t=>({...copy(t),id:id(),role:'完整组合'})),favorites:copy(old.favorites||[]),format:old.format||'comfy'};
    return validate(s);
  }
  return {seedValue,schemeSeeds,copy,id,roles,characterPresets,installBandTemplates,installCharacterTemplates,upgradeCharacters,identityTokens,proseWarnings,block,prose,scheme,validate,validateCharacters,languageFields,aliases,fromTemplate,duplicate,assemble,importLegacy};
})();
