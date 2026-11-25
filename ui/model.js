'use strict';
const Blocks = (() => {
  const copy = typeof structuredClone === 'function' ? value => structuredClone(value) : value => JSON.parse(JSON.stringify(value));
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
    {group:"绝区零", tag:"zenless zone zero", migration:"franchisePresets20261122", members:[
      {"label":"青衣","name":"Qingyi","features":[["long green twintails","绿色长双马尾"],["green eyes","绿瞳"],["mechanical joints","机械关节"]]},
      {"label":"安比","name":"Anby Demara","features":[["short silver hair","银色短发"],["single side braid","单侧细辫"],["black headphones","黑色耳机"]]},
      {"label":"扳机","name":"Trigger","features":[["long blonde ponytail","金色长马尾"],["luminous eye visor","发光护目镜"]]},
      {"label":"奥菲斯","name":"Orphie Magnusson","features":[["long orange twintails","橙色长双马尾"],["black mechanical horns","黑色机械角"],["green eyes","绿瞳"]]},
      {"label":"席德","name":"Seed","review":"复核跳过 · REED Anima v1.4","features":[["long mint-blue braids","薄荷蓝长辫"],["ahoge","翘起的呆毛"],["blue eyes","蓝瞳"]]},
    ]},
    {group:"崩坏3", tag:"honkai impact 3rd", migration:"franchisePresets20261122", members:[
      {"label":"幽兰黛尔","name":"Durandal","features":[["long wavy blonde hair","波浪金长发"],["blue eyes","蓝瞳"],["swept bangs","斜分刘海"]]},
      {"label":"丽塔","name":"Rita Rossweisse","features":[["short ash-blonde hair","灰金色短发"],["bangs covering one eye","长刘海遮住一眼"],["reddish pink eyes","玫红眼睛"]]},
      {"label":"薇塔","name":"Vita","features":[["long grey hair with dark green streaks","灰色长发配深绿发束"],["red eyes","红瞳"],["peacock motif","孔雀纹样"]]},
      {"label":"赫丽雅","name":"Erdos Helia","features":[["long silver-grey hair","银灰长发"],["hair intakes","两侧向上拱起的前发"],["beauty mark under left eye","本人左眼下泪痣"]]},
      {"label":"科拉莉","name":"Coralie 6626 Planck","features":[["long black and grey hair","黑灰双色长发"],["black dog ears","黑色犬耳"],["black beret","黑色贝雷帽"]]},
      {"label":"爱莉希雅","name":"Elysia","features":[["long pink hair","粉色长发"],["pointed elf ears","尖精灵耳"],["blue eyes","蓝瞳"]]},
      {"label":"梅比乌斯","name":"Mobius","features":[["long wavy mint-green hair","薄荷绿波浪长发"],["slit pupils","竖瞳"],["single gold earring","单侧金耳坠"]]},
      {"label":"伊甸","name":"Eden","features":[["long wine-red hair","酒红长发"],["amber eyes","琥珀瞳"],["gold hair ornament","金色发饰"]]},
      {"label":"帕朵菲利斯","name":"Pardofelis","features":[["sandy brown hair","沙棕色头发"],["cat ears","猫耳"],["one blue eye and one green eye","一蓝一绿异色瞳"]]},
    ]},
    {group:"崩坏·星穹铁道", tag:"honkai: star rail", migration:"franchisePresets20261122", members:[
      {"label":"镜流 · 眼罩版","migration":"jingliuVariants20261122","name":"Jingliu","features":[["long silver hair","银色长发"],["black blindfold","黑色眼罩"],["crescent moon motif","弯月纹样"]]},
      {"label":"镜流 · 露眼版","migration":"jingliuVariants20261122","name":"Jingliu","features":[["long silver hair","银色长发"],["both crimson eyes visible","露出双眼，绯红瞳色"],["crescent moon motif","弯月纹样"]]},
      {"label":"大黑塔","name":"The Herta","features":[["very long ash-brown hair","灰棕色长发"],["wide-brimmed witch hat","宽檐魔女帽"],["purple eyes","紫瞳"]]},
      {"label":"小黑塔","name":"Herta","features":[["long brown hair","棕色长发"],["purple flower on beret","贝雷帽上的紫花"],["ball-jointed doll","球关节人偶"]]},
      {"label":"飞霄","name":"Feixiao","features":[["high white ponytail","白色高马尾"],["white fox ears","白色狐耳"],["turquoise eyes","青碧眼睛"]]},
    ]},
    {group:"原神", tag:"genshin impact", migration:"franchisePresets20261122", members:[
      {"label":"申鹤","name":"Shenhe","features":[["long silver braid","银白长辫"],["red hair cords","红色系绳"],["pale iridescent eyes","浅色虹彩眼睛"]]},
      {"label":"夜兰","name":"Yelan","features":[["asymmetrical dark blue bob","不对称深蓝短发"],["blue hair tips","蓝色发梢"],["green eyes","绿瞳"]]},
      {"label":"凝光","name":"Ningguang","features":[["long white hair","白色长发"],["red eyes","红瞳"],["golden hairpins","金色发簪"]]},
      {"label":"心海","name":"Sangonomiya Kokomi","features":[["long pale pink hair","浅粉色长发"],["blue-violet eyes","蓝紫瞳"],["large blue hair bow","蓝色大蝴蝶结"]]},
      {"label":"妮露","name":"Nilou","features":[["long red hair","红色长发"],["turquoise eyes","青碧眼睛"],["golden horned headdress","金色角形头冠"]]},
      {"label":"芙宁娜","name":"Furina","features":[["short white hair with blue streaks","带蓝色挑染的白色短发"],["blue heterochromia","深浅蓝异色瞳"],["tilted top hat","歪戴的小礼帽"]]},
      {"label":"艾梅莉埃","name":"Emilie","features":[["blonde bob with pink tips","发梢泛粉的金色短发"],["pink eyes","粉瞳"],["glasses","眼镜"]]},
    ]},
    {group:"刀剑神域", tag:"sword art online", migration:"franchisePresets20261122", members:[
      {"label":"亚丝娜","name":"Yuuki Asuna","features":[["long chestnut hair","栗色长发"],["half-up braid","半束编发"],["hazel eyes","榛色眼睛"]]},
      {"label":"桐谷直叶","name":"Kirigaya Suguha","features":[["short black hair","黑色短发"],["dark grey eyes","深灰眼睛"],["hair clip","发夹"]]},
      {"label":"莉法","name":"Leafa","features":[["high blonde ponytail","金色高马尾"],["pointed elf ears","尖精灵耳"],["green eyes","绿瞳"]]},
      {"label":"爱丽丝","name":"Alice Zuberg","features":[["long golden hair","金色长发"],["blue eyes","蓝瞳"],["white headband","白色发带"]]},
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
    if (c.review) preset.review = c.review;
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
  for(const {group,tag,members,migration:groupMigration} of franchiseGroups){
    for(const c of members){
      const identity=[[c.name.toLowerCase(),c.label],[tag,group]];
      if(c.form)identity.push([c.form,c.label.split(' · ')[1]]);
      const migration=c.migration || groupMigration || 'franchisePresets20261119';
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
    // Keep the original template ID when upgrading an unmodified blindfold preset.
    if (state.migrations?.franchisePresets20261122 && !state.migrations.jingliuVariants20261122) {
      const variants = franchiseTemplateBatches.get('jingliuVariants20261122');
      const masked = variants.find(t => t.label === '镜流 · 眼罩版');
      const original = state.templates.find(t => t.name === '镜流' && t.role === '角色' &&
        t.weight === 1 && t.negative.length === 0 && t.positive.length === masked.entries.length &&
        t.positive.every((token,i) => token.text === masked.entries[i][0] &&
          token.label === (i === 0 ? '镜流' : masked.entries[i][1]) && token.enabled && token.weight === 1));
      if (original && !state.templates.some(t => t.name === masked.label && t.role === '角色')) {
        original.name = masked.label;
      }
    }
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
  function validateCharacters(list) {if(list===undefined)return;if(!Array.isArray(list))throw Error('角色定义格式无效');const used=new Set();for(const c of list){if(!c||typeof c.alias!=='string'||!/^[A-Z][A-Z0-9_]{0,15}$/.test(c.alias)||used.has(c.alias)||typeof c.name!=='string'||!c.name.trim()||typeof c.description!=='string'||typeof (c.sourceDescription??'')!=='string'||typeof (c.translatedFrom??'')!=='string'||typeof (c.identityTags??'')!=='string'||typeof (c.blockId??'')!=='string'||!['unknown','female','male','other'].includes(c.gender??'unknown')||/[{}]/.test(c.name+c.description+(c.identityTags||'')))throw Error('角色代号必须唯一，名字、身份标签和描述不能嵌套变量，性别选项须有效');used.add(c.alias);}}
  function languageFields(b) {return {kind:b.kind||'tags',positiveText:b.positiveText||'',negativeText:b.negativeText||'',positiveSource:b.positiveSource||'',negativeSource:b.negativeSource||'',positiveTranslatedFrom:b.positiveTranslatedFrom||'',negativeTranslatedFrom:b.negativeTranslatedFrom||''};}
  function validate(s) {
    if(s?.theme!==undefined&&!['forest','midnight','violet','ember','graphite','neon','aurora','paper','mist','sakura','xuanzhi'].includes(s.theme))throw Error('未知配色');
    if(!s || s.version!==2 || !Array.isArray(s.schemes) || !s.schemes.length || !Array.isArray(s.templates) || !Array.isArray(s.favorites) || !['comfy','nai','plain'].includes(s.format)) throw Error('不是有效的分块版工作区');
    const customWords = s.customWords === undefined ? [] : s.customWords;
    if (!Array.isArray(customWords)) throw Error('自定义词库格式无效');
    const wordKeys = new Set();
    for (const word of customWords) {
      if (!word || ['text','label','group'].some(key => typeof word[key] !== 'string' || !word[key].trim()) || typeof word.negative !== 'boolean')
        throw Error('自定义词条缺少原文、名称、子分类或用途');
      const key = norm(word.text);
      if (wordKeys.has(key)) throw Error('自定义词库中已有相同提示词');
      wordKeys.add(key);
    }
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
    const upgraded=copy(s);upgraded.customWords ??= [];for(const p of [...upgraded.schemes,...upgraded.templates]){if(p.characters)p.characters=upgradeCharacters(p.characters);for(const b of p.blocks||[])if(b.characters)b.characters=upgradeCharacters(b.characters);}return upgraded;
  }
  function fromTemplate(t) {return {...block(t.name,t.role,t.positive,t.negative),...languageFields(t),weight:t.weight??1,sourceTemplateId:t.id,recipe:t.recipe||''};}
  function duplicate(b) {return {...copy(b),id:id(),name:b.name+' · 副本'};}
  function assemble(p,format='comfy',raw=false) {
    const result={positive:'',negative:'',warnings:[],errors:[],counts:{positive:0,negative:0},paragraphs:{positive:0,negative:0},sources:{positive:[],negative:[]}};
    for(const side of ['positive','negative']) {
      const seen=new Map(),out=[];
      // 角色定义关联了某个角色块时，该块的词归到这个角色名下输出一次（不另加身份标签和外貌介绍）。
      const linked=new Map((p.characters||[]).filter(c=>c.blockId&&p.blocks.some(b=>b.id===c.blockId)).map(c=>[c.blockId,c.alias]));
      for(const b of p.blocks.filter(b=>b.enabled&&!(side==='positive'&&linked.has(b.id))))for(const t of b[side].filter(t=>t.enabled)) {
        const blockName=linked.has(b.id)?'角色 '+linked.get(b.id)+'（'+b.name+'）':b.name;
        const w=Number((t.weight*b.weight).toFixed(6)),key=norm(t.text),existing=seen.get(key)||[];
        if(existing.some(x=>x.weight!==w))result.warnings.push(`${side==='positive'?'正面':'负面'}重复词「${t.text}」权重不同：${existing.map(x=>x.block+' ×'+x.weight).join('、')} / ${blockName} ×${w}；已保留两处，请自行调整。`);
        if(existing.some(x=>x.weight===w)) {const src=result.sources[side].find(x=>x.key===key&&x.weight===w);src.blocks.push(blockName);if(!src.blockIds.includes(b.id))src.blockIds.push(b.id);continue;}
        const text=format==='plain'||w===1?t.text:format==='nai'?`${w}::${t.text}::`:`(${t.text}:${w})`;
        out.push(text);existing.push({weight:w,block:blockName});seen.set(key,existing);
        result.sources[side].push({key,text:t.text,weight:w,blocks:[blockName],blockIds:[b.id]});
      }
      result[side]=out.join(', ');result.counts[side]=out.length;
    }
    const pos=new Set(result.sources.positive.map(x=>x.key)),neg=new Set(result.sources.negative.map(x=>x.key));
    for(const t of pos)if(neg.has(t))result.warnings.push(`「${t}」同时出现在正面和负面，请检查用途。`);
    if(pos.has('solo')&&(pos.has('2girls')||pos.has('2boys')||pos.has('multiple girls')))result.warnings.push('solo 与多人标签同时启用，请检查人数设定。');
    if(pos.has('1girl')&&pos.has('2girls'))result.warnings.push('1girl 与 2girls 同时启用，请检查人数设定。');
    const chars=new Map((p.characters||[]).map(c=>[c.alias,c])),used=new Set(),isLinked=c=>!!(c.blockId&&p.blocks.some(b=>b.id===c.blockId));
    for(const side of ['positive','negative']) {
      const paragraphs=[];
      for(const b of p.blocks.filter(b=>b.enabled&&b.kind==='prose')) {
        const source=b[side+'Source']||'',text=b[side+'Text']||'';
        if(source.trim()&&!text.trim())result.errors.push(`「${b.name}」${side==='positive'?'正面':'负面'}尚未翻译。`);
        if(source.trim()&&text.trim()&&b[side+'TranslatedFrom']!==source)result.errors.push(`「${b.name}」中文已修改，请更新对应英文。`);
        if(!text.trim())continue;
        for(const warning of proseWarnings(text,p.characters,source))result.warnings.push(`「${b.name}」${warning}`);
        // 代号次数不一致只提醒、不拦截：译文常把重复出现的人物改成代词，意思未必错，交给用户判断。
        if(source.trim()&&JSON.stringify(aliases(source).sort())!==JSON.stringify(aliases(text).sort())){const tally=list=>list.reduce((m,a)=>(m[a]=(m[a]||0)+1,m),{}),zh=tally(aliases(source)),en=tally(aliases(text));const diff=[...new Set([...Object.keys(zh),...Object.keys(en)])].filter(a=>zh[a]!==en[a]).map(a=>`{{${a}}} 中文 ${zh[a]||0} 次、英文 ${en[a]||0} 次`);result.warnings.push(`「${b.name}」角色代号次数不同：${diff.join('；')}。可能是译文把人物写成了代词，请确认指代没错。`);}
        const expanded=raw?text:text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,15})\s*\}\}/g,(match,key)=>{const alias=key.toUpperCase(),c=chars.get(alias);if(!c){result.errors.push(`未定义角色 {{${alias}}}（${b.name}）`);return match;}if(side==='positive')used.add(alias);return c.name;});
        if(!raw&&/[{}]/.test(expanded))result.errors.push(`「${b.name}」存在未展开的占位符，请使用 {{A}} 这类格式。`);
        paragraphs.push(expanded.trim());result.sources[side].push({key:'prose:'+b.id,text:expanded,weight:1,blocks:[b.name],blockIds:[b.id],kind:'prose'});
      }
      result.paragraphs[side]=paragraphs.length;
      const introductions=[];
      if(!raw&&side==='positive'&&p.autoIdentity!==false){
        const added=[];
        for(const alias of used){const c=chars.get(alias);if(isLinked(c))continue;const tags=identityTokens(c);if(!tags.length)result.warnings.push(`角色 ${alias}（${c.name}）未填写身份标签；原创角色可留空，已有角色建议补全姓名与作品标签。`);
          for(const text of tags){const key=norm(text);const existing=result.sources.positive.find(x=>x.key===key);if(existing){if(!existing.blocks.includes('角色 '+alias))existing.blocks.push('角色 '+alias);continue;}
            added.push(text);result.sources.positive.push({key,text,weight:1,blocks:['角色 '+alias],blockIds:[]});result.counts.positive++;if(neg.has(key))result.warnings.push(`身份标签「${text}」同时出现在负面，请检查用途。`);
          }
        }
        result.positive=[result.positive,...added].filter(Boolean).join(', ');
      }
      if(!raw&&side==='positive')for(const c of p.characters||[]){const lb=isLinked(c)&&p.blocks.find(b=>b.id===c.blockId);if(!lb||!lb.enabled)continue;
        const parts=lb.positive.filter(t=>t.enabled).map(t=>{const w=Number((t.weight*lb.weight).toFixed(6));return format==='plain'||w===1?t.text:format==='nai'?`${w}::${t.text}::`:`(${t.text}:${w})`;});
        if(!parts.length)continue;introductions.push(`${c.name}: ${parts.join(', ')}.`);result.sources.positive.push({key:'character:'+c.alias,text:`${c.name}: ${parts.join(', ')}`,weight:1,blocks:['角色 '+c.alias+'（'+lb.name+'）'],blockIds:[lb.id],kind:'character'});}
      if(!raw&&side==='positive'&&p.autoIntroduce!==false)for(const alias of used){const c=chars.get(alias);if(isLinked(c))continue;if(c.sourceDescription?.trim()&&(!c.description.trim()||c.translatedFrom!==c.sourceDescription))result.errors.push(`角色 ${alias} 的中文外貌尚未翻译或已修改。`);if(c.description.trim())introductions.push(`${c.name}: ${c.description.trim()}${/[.!?。！？]$/.test(c.description.trim())?'':'.'}`);}
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
