/**
 * Base oficial de conhecimento do Reels Lab:
 * - Os 5 Modelos de Série (O Meu Modelo de Reels - Leislin Eduarda)
 * - Código Viral (Oney Araujo)
 * - Guia das 33 Profissões / 165 Ideias
 * - Extra 1: 14 Travas e Soluções (Guia Destrava)
 */

export const SERIES_MODELS = [
  {
    id: 'serie_01',
    code: 'Série 01',
    name: 'O que todo mundo deveria fazer, mas não faz',
    shortName: 'O que deveriam fazer',
    trigger: 'Curiosidade + Identificação',
    titlePattern: 'O que toda pessoa que [situação ou objetivo] deveria fazer, mas não faz (parte X).',
    altPattern: 'O que toda [descrição específica do público] deveria fazer, mas não faz.',
    nameRule: 'Muda a situação ou o grupo do público, mantendo a fórmula "O que toda... deveria fazer, mas não faz".',
    about: 'Mostra atitudes que as pessoas deveriam ter para resolver um problema, evitar uma dificuldade ou conquistar algo que desejam, mas normalmente ignoram.',
    structureFlow: 'Situação específica → Atitude recomendada → Como ajuda na prática → Exemplo + Comparação → Mudança de comportamento',
    template: {
      comeco: '"O que toda pessoa que [situação ou objetivo] deveria fazer, mas não faz.\nTodo mundo que [descreva o desejo ou problema] deveria [apresente a ação que você recomenda]."',
      desenvolvimento: '"Aqui você vai [explique como essa atitude pode ajudar a pessoa].\nPor exemplo, [mostre uma situação prática em que ela poderia aplicar sua recomendação].\nÉ como se você [faça uma comparação simples para a pessoa entender o benefício]."',
      finalizacao: '"Assim você para de [comportamento que não ajuda] e começa a [comportamento que aproxima do resultado desejado]."'
    }
  },
  {
    id: 'serie_02',
    code: 'Série 02',
    name: 'Comece a...',
    shortName: 'Comece a...',
    trigger: 'Ação Imediata + Curiosidade',
    titlePattern: 'Comece a [ação prática que seu público deveria fazer].',
    altPattern: 'Comece a [ação simples para aplicar ainda hoje].',
    nameRule: 'O nome muda a cada episódio, mas o começo continua sempre sendo "Comece a...".',
    about: 'Mostra uma atitude simples e acionável que o público consegue colocar em prática ainda hoje para destravar um resultado.',
    structureFlow: 'Recomendação ("Comece a...") → Problema de não seguir → Consequência cotidiana → Passo 1 e Passo 2 práticos → Fechamento reforçando',
    template: {
      comeco: '"Comece a [ação que você recomenda].\nA maioria das pessoas [descreva o comportamento que está atrapalhando o resultado]."',
      desenvolvimento: '"Isso acontece porque [explique por que as pessoas costumam fazer isso].\nDaí você [mostre uma situação cotidiana em que esse comportamento acontece].\nE quando você [consequência desse comportamento], você acaba [mostre como isso prejudica a pessoa].\nEntão, pra [resultado que a pessoa deseja], faz isso aqui."',
      solucao: '"O primeiro passo é [primeira orientação prática]. [Explique como colocar em prática].\nO segundo passo é [segunda orientação prática]. [Explique por que ajuda e como fazer]."',
      finalizacao: '"Então, se você quer [resultado desejado], começa a [reforce a principal recomendação do vídeo]."'
    }
  },
  {
    id: 'serie_03',
    code: 'Série 03',
    name: 'A pessoa que...',
    shortName: 'A pessoa que...',
    trigger: 'Identificação Extrema ("Meu Deus, sou eu!")',
    titlePattern: 'A [pessoa/mulher/mãe] que [situação específica do dia a dia] não deveria [comportamento que atrapalha].',
    altPattern: 'A pessoa que [situação hiperespecífica] precisa entender isso.',
    nameRule: 'Muda a situação específica a cada episódio. Nunca use objetivo genérico ("que quer emagrecer") — descreva uma cena real vivida.',
    about: 'Retrata comportamentos muito específicos do cotidiano que atrapalham o resultado sem a pessoa perceber, gerando choque imediato de reconhecimento.',
    structureFlow: 'Situação específica → Comportamento habitual → Consequência real → Solução ("Eu no teu lugar...") → Quebra de objeção → Fechamento',
    template: {
      comeco: '"A pessoa que [descreva uma situação muito específica do teu público] não deveria [comportamento que está atrapalhando o resultado]."',
      desenvolvimento: '"Eu sei que você [explique o motivo pelo qual a pessoa tem esse comportamento].\nEntão você [descreva o que ela costuma fazer].\n[Continue mostrando como essa situação acontece no dia a dia, com detalhes reais].\nSó que quando você percebe, [mostre a consequência desse comportamento]."',
      solucao: '"Eu, no seu lugar, [apresente o que faria de diferente].\n[Explique como colocar essa recomendação em prática]."',
      quebraObjecao: '"Porque você pode ter certeza: [explique por que aquilo que a pessoa teme ou acredita não deveria impedir a mudança]. [Mostre o que realmente importa]."',
      finalizacao: '"Então, se você [retome a situação inicial], não faz sentido [comportamento que atrapalha]. [Conecte ao seu produto ou CTA]."'
    }
  },
  {
    id: 'serie_04',
    code: 'Série 04',
    name: 'Como [fazer algo] sem [hábito comum]',
    shortName: 'Como fazer sem...',
    trigger: 'Curiosidade + Quebra de Crença',
    titlePattern: 'Como [fazer alguma coisa desejada] sem [hábito ou dificuldade comum] (parte X).',
    altPattern: 'Como [resultado] sem [o que a pessoa odeia fazer] (parte X).',
    nameRule: 'IMPORTANTE: O nome principal da série continua O MESMO nas partes seguintes! O que muda é a nova alternativa prática ensinada em cada episódio.',
    about: 'Ensina maneiras diferentes de conquistar algo sem precisar de um hábito difícil ou chato que a pessoa acredita ser obrigatório.',
    structureFlow: 'Nome fixo da série (Parte X) → Alternativa prática imediata → Por que funciona → 2 Exemplos cotidianos → Cuidado importante + Orientação final',
    template: {
      comeco: '"Como [fazer alguma coisa] sem [hábito ou dificuldade comum] (parte [número]).\nFaz desse jeito aqui: [apresente uma alternativa prática]."',
      desenvolvimento: '"Isso funciona tão bem porque [explique por que essa alternativa pode ser melhor].\n[Mostre o que muda quando a pessoa começa a fazer dessa maneira]."',
      exemplos: '"Por exemplo, se você [primeira situação cotidiana], pode [mostre como usar].\nSe você [segunda situação], pode [apresente outra aplicação]."',
      finalizacao: '"Mas antes de você sair fazendo isso, tem uma coisa que você precisa lembrar: [apresente um cuidado importante e o que evitar].\nEntão [reforce a orientação principal de maneira simples e direta]."'
    }
  },
  {
    id: 'serie_05',
    code: 'Série 05',
    name: 'Quem quer... deveria fazer isso aqui',
    shortName: 'Quem quer... deveria fazer',
    trigger: 'Desejo ("Eu quero isso!")',
    titlePattern: 'Quem quer [resultado específico que seu público deseja] deveria fazer isso aqui [contexto].',
    altPattern: 'Quem quer [dor que quer eliminar] deveria fazer isso aqui.',
    nameRule: 'Escolha um desejo específico ou incômodo concreto em cada episódio — nunca algo vago como "ter uma vida melhor".',
    about: 'Conecta um desejo real e específico do público a uma atitude prática que aproxima a pessoa do resultado, sendo excelente para fundo de funil e CTA.',
    structureFlow: 'Resultado desejado → Erro comum → Nova atitude → Exemplo prático → Benefício → Orientação passo a passo → CTA',
    template: {
      comeco: '"Quem quer [resultado que seu público deseja] deveria fazer isso aqui [contexto, se necessário]."',
      desenvolvimento: '"Em vez de ficar [comportamento comum que não ajuda], você vai começar a [atitude recomendada]."',
      exemploPratico: '"Por exemplo, [situação real muito comum do público]. [Mostre como aplicar a recomendação nessa situação]."',
      explicacao: '"Quem [dificuldade do público] vai [como a recomendação ajuda]. E enquanto você [ação], vai estar [benefício]."',
      orientacao: '"Agora pensa na sua [rotina/trabalho]. Você vai pegar [algo específico que a pessoa já tem/faz] e [o que fazer com isso]."',
      finalizacao: '"E pra você [resultado ligado ao seu produto/serviço], [apresente sua solução e CTA]."'
    }
  },
  {
    id: 'codigo_viral',
    code: 'Código Viral',
    name: 'Reels de Alta Retenção (Gancho + Benefício + Porta na Cara)',
    shortName: 'Código Viral (Timing/Alcance)',
    trigger: 'Urgência + Segredo + Quebra de Padrão',
    titlePattern: '[Gancho de 2s Específico + Curioso + Urgente]',
    altPattern: '[Notícia/Timing do momento conectado ao nicho]',
    nameRule: 'Ideal para vídeos rápidos de Descoberta (<30s), Timing de notícias atuais ou técnica "Gancho + Leia a Legenda".',
    about: 'Estrutura pura do Código Viral focada em prender nos primeiros 2 segundos, limpar quebras de retenção, mostrar na prática ("Mostre!") e finalizar com corte seco (Porta na Cara).',
    structureFlow: 'Gancho 2s → Benefício imediato → Entrega direta ("Mostre!") → CTA estratégico (ManyChat/Opinião) → Corte seco Porta na Cara',
    template: {
      comeco: '"[Gancho de 2 segundos com palavra de curiosidade]. [Benefício claro: ...e nos próximos 30 segundos eu vou te mostrar como você também consegue isso]."',
      desenvolvimento: '"[Entrega direta sem introdução: passo prático ou demonstração visual do que fazer, atacando o erro comum]."',
      finalizacao: '"[CTA estratégico no ritmo da fala + Corte seco imediato antes que a pessoa perceba que acabou — Porta na Cara]."'
    }
  }
];

export const VIRAL_CODE = {
  hierarchies: [
    { id: 'save', rank: 4, label: 'Salvar (Vídeos úteis / Passo a passo)', hint: 'Mostre um checklist ou método prático para a pessoa salvar e consultar depois.' },
    { id: 'share', rank: 3, label: 'Compartilhar no Direct / Stories', hint: 'Crie identificação ou alerta urgente que faça a pessoa mandar para alguém ("manda pra quem precisa").' },
    { id: 'comment', rank: 5, label: 'Comentários / Automação ManyChat', hint: 'Peça uma palavra-chave para entregar algo no Direct ou gere debate com 2 opções.' },
    { id: 'copylink', rank: 1, label: 'Copiar Link (Topo da Hierarquia)', hint: 'Conteúdo de choque, polêmica inteligente ou descoberta que as pessoas mandam no WhatsApp.' },
    { id: 'audio', rank: 2, label: 'Áudio em Alta / Modelo Replicável', hint: 'Frase ou estrutura tão marcante que outros criadores vão querer usar o mesmo áudio/formato.' },
    { id: 'read_caption', rank: 4, label: 'Gancho + Leia a Legenda (Loop de Retenção)', hint: 'Vídeo curtíssimo (7–15s) que entrega o gancho visual e joga os 3 parágrafos completos para a legenda.' }
  ],
  funnelStages: [
    { id: 'topo', label: 'Topo: Descoberta (até 30s)', focus: 'Alcance massivo. Qualquer pessoa entende fácil; linguagem simples e identificação ampla.' },
    { id: 'meio', label: 'Meio: Conexão (30s a 45s)', focus: 'Aprofundamento prático para quem já tem a dor e quer método claro e autoridade.' },
    { id: 'fundo', label: 'Fundo: Venda (45s a 60s)', focus: 'Quebra de objeções específicas preparando para o produto, consulta ou palavra-chave no Direct.' }
  ],
  powerWords: ['Assim', 'Truque', 'Isso', 'Entenda', 'Veja', 'Aquilo', 'Razão', 'Segredo', 'Como'],
  hooks: [
    'Pode parecer estranho o que vou falar aqui para vocês...',
    'Por que ninguém está falando de...',
    'Você deve ser o último a saber sobre...',
    'Eu pensei que era mentira, mas...',
    'Você precisa parar de fazer isso assim...',
    'Eu vou provar para você em 1 minuto...',
    'Isso que eu vou falar agora pode parecer muito estranho, mas...',
    'Era segredo, mas eu descobri que...',
    'Poucas pessoas sabem, mas...',
    'A maior mentira sobre...',
    'A prova está aqui: esta é a melhor forma de...',
    'Um truque psicológico para...',
    'Eu vou te mostrar como...',
    'Você sabia que...',
    'O dia em que eu descobri...',
    'O segredo que não te contam sobre...',
    'Você não vai acreditar no que acontece quando...',
    'A melhor forma de...',
    'Cuidado com isso se você...',
    'Para tudo agora e olha isso...',
    'A forma mais fácil de...',
    'Como economizar uma tonelada de tempo com...',
    'A primeira coisa que você precisa fazer para...',
    'Esse ajuste simples vai te trazer resultados absurdos se...',
    'Se eu começasse hoje a [objetivo], eu faria isso aqui diferente.'
  ],
  ctas: [
    'Agora me conta nos comentários se você concorda ou discorda...',
    'Comenta a palavra [PALAVRA-CHAVE] que eu te envio no Direct.',
    'Já passou por algo semelhante? Me conta aqui que eu vou responder.',
    'Salva esse vídeo para não esquecer na hora que precisar.',
    'Se você lembrou de alguém assistindo isso, manda no Direct dela agora.',
    'Qual você prefere: Opção A ou Opção B? Comenta aqui.',
    'Se ficou alguma dúvida do teu caso, deixa nos comentários que pode virar a próxima parte.',
    'Quer acompanhar as próximas partes dessa série? Já toca em seguir.',
    'Comenta [PALAVRA-CHAVE] para receber o guia completo no seu Direct.'
  ],
  bestHours: ['09h00 – 11h00', '12h00 – 13h00', '18h00 – 19h30'],
  preRecordChecklist: [
    'Começa direto no nome da série / gancho (ZERO "oi, gente, tudo bem?")',
    'Tem 1 único problema ou orientação por vídeo (sem misturar 5 assuntos)',
    'Passa no Teste da Conversa (sem palavras de seminário que não usaria com uma amiga)',
    'Entrega o que prometeu no gancho em até 60 segundos (ideal 30-45s)',
    'Termina com corte seco rápido (Porta na Cara) sem despedida longa'
  ]
};

export const PROFESSIONS = [
  {
    id: 'nutricao',
    category: 'Saúde e Corpo',
    name: 'Nutrição',
    subtitle: 'Pra quem quer comer melhor sem viver de dieta.',
    series: [
      { modelId: 'serie_01', title: 'O que toda pessoa deveria fazer, mas não faz', parts: [
        'O que toda mulher que quer emagrecer deveria fazer, mas não faz.',
        'O que toda mãe de criança que não come verdura deveria fazer, mas não faz.',
        'O que toda mulher que treina há meses sem resultado deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a montar teu prato pela metade de legumes.',
        'Comece a oferecer o mesmo alimento mais de uma vez, de jeitos diferentes.',
        'Comece a planejar o que tu vai comer depois do treino.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que passa o dia sem comer e ataca a geladeira à noite não deveria achar que o problema é falta de força de vontade.',
        'A mãe que oferece suco no lugar da fruta não deveria achar que é a mesma coisa.',
        'A mulher que corta o carboidrato pra secar não deveria estranhar o treino ruim.'
      ]},
      { modelId: 'serie_04', title: 'Como emagrecer sem cortar tudo que tu gosta (parte 1)', parts: [
        'Encaixar o doce no dia, em vez de proibir.',
        'Trocar o tamanho da porção, não o alimento.',
        'Montar um lanche que segura a fome até o jantar.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer parar de beliscar o dia inteiro deveria fazer isso aqui.',
        'Quem quer uma lancheira saudável que volta vazia deveria fazer isso aqui.',
        'Quem treina de manhã cedo deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'personal_trainer',
    category: 'Saúde e Corpo',
    name: 'Personal trainer',
    subtitle: 'Pra quem quer começar a treinar e não desistir.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que treina em casa deveria fazer, mas não faz.',
        'O que toda mãe que só treina quando o filho dorme deveria fazer, mas não faz.',
        'O que toda pessoa que começou a treinar agora deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a deixar o tapete de treino à vista.',
        'Comece a treinar 20 minutos em vez de esperar ter uma hora.',
        'Comece a anotar quantas repetições tu fez.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que só tem 20 minutos pra treinar não deveria perder 10 escolhendo vídeo no YouTube.',
        'A pessoa que treina em casa não deveria achar que sem peso não tem resultado.',
        'A mãe que desiste do treino quando o filho acorda não deveria achar que perdeu o dia.'
      ]},
      { modelId: 'serie_04', title: 'Como treinar em casa sem comprar equipamento (parte 1)', parts: [
        'Usar uma mochila com livros como carga.',
        'Trocar o peso por mais tempo de execução.',
        'Usar a escada como treino de perna.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer fortalecer o bumbum em casa deveria fazer isso aqui.',
        'Quem quer criar o hábito de treinar deveria fazer isso aqui.',
        'Quem quer treinar mesmo com a rotina cheia deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'fisioterapia',
    category: 'Saúde e Corpo',
    name: 'Fisioterapia',
    subtitle: 'Pra quem trabalha sentada e vive com dor.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que trabalha sentada o dia inteiro deveria fazer, mas não faz.',
        'O que toda mulher que acorda com dor no pescoço deveria fazer, mas não faz.',
        'O que toda mãe que carrega o filho no colo o dia todo deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a levantar da cadeira a cada uma hora.',
        'Comece a colocar a tela do computador na altura dos olhos.',
        'Comece a carregar a bolsa alternando os ombros.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que trabalha no notebook no sofá não deveria estranhar a dor no fim do dia.',
        'A mulher que dorme de bruços não deveria achar que o travesseiro resolve tudo.',
        'A pessoa que só se alonga quando a dor aparece não deveria esperar que ela não volte.'
      ]},
      { modelId: 'serie_04', title: 'Como aliviar a dor nas costas sem parar de trabalhar (parte 1)', parts: [
        'Um alongamento pra fazer sentada na cadeira.',
        'Um ajuste simples no jeito de sentar.',
        'Uma pausa de 2 minutos entre as reuniões.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer parar de acordar com dor deveria fazer isso aqui.',
        'Quem trabalha em home office deveria fazer isso aqui.',
        'Quem quer melhorar a postura sem pensar nisso o dia inteiro deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'psicologia',
    category: 'Saúde e Corpo',
    name: 'Psicologia',
    subtitle: 'Pra quem quer mais calma na cabeça e relações mais leves.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vive ansiosa deveria fazer, mas não faz.',
        'O que toda pessoa que tem medo de ser abandonada deveria fazer, mas não faz.',
        'O que toda mulher que vive no automático deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a escrever o que tá te preocupando antes de dormir.',
        'Comece a combinar as conversas difíceis pra hora certa.',
        'Comece a separar o que tu controla do que tu não controla.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que responde mensagem de trabalho até meia-noite não deveria estranhar a cabeça que não desliga.',
        'A mulher que vive pedindo desculpa por tudo não deveria achar que isso é ser educada.',
        'A pessoa que imagina o pior cenário antes de tudo não deveria acreditar em todo pensamento que aparece.'
      ]},
      { modelId: 'serie_04', title: 'Como acalmar a ansiedade sem fugir do que tu sente (parte 1)', parts: [
        'Uma respiração simples pra fazer na hora da crise.',
        'Nomear a emoção em vez de brigar com ela.',
        'Trazer a atenção pro corpo quando a mente acelera.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer dormir sem a cabeça a mil deveria fazer isso aqui.',
        'Quem quer aprender a dizer não deveria fazer isso aqui.',
        'Quem quer começar o dia menos ansiosa deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'odontologia',
    category: 'Saúde e Corpo',
    name: 'Odontologia',
    subtitle: 'Pra quem quer um sorriso bonito e saudável.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que quer clarear os dentes deveria fazer, mas não faz.',
        'O que toda pessoa que usa aparelho deveria fazer, mas não faz.',
        'O que toda pessoa que tem vergonha de sorrir em foto deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a usar fio dental todos os dias.',
        'Comece a esperar alguns minutos pra escovar depois do café.',
        'Comece a trocar a escova a cada três meses.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que escova os dentes com força não deveria achar que tá limpando melhor.',
        'A pessoa que clareia o dente em casa sem orientação não deveria estranhar a sensibilidade.',
        'A pessoa que só vai ao dentista quando dói não deveria achar que tá economizando.'
      ]},
      { modelId: 'serie_04', title: 'Como manter os dentes brancos sem abrir mão do café (parte 1)', parts: [
        'Beber água logo depois do café.',
        'Usar canudo nas bebidas que mancham.',
        'Manter as limpezas em dia.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer um sorriso mais branco deveria fazer isso aqui.',
        'Quem quer sorrir nas fotos sem vergonha deveria fazer isso aqui.',
        'Quem quer evitar cárie sem complicar a rotina deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'veterinaria',
    category: 'Saúde e Corpo',
    name: 'Medicina veterinária',
    subtitle: 'Pra tutores que querem um cachorro saudável e tranquilo.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que todo tutor de filhote deveria fazer, mas não faz.',
        'O que todo tutor que deixa o cachorro sozinho o dia todo deveria fazer, mas não faz.',
        'O que todo tutor de cachorro idoso deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a escovar os dentes do teu cachorro.',
        'Comece a levar teu cachorro pra passear antes de sair de casa.',
        'Comece a pesar teu cachorro uma vez por mês.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'O tutor que dá comida da mesa pro cachorro não deveria achar que é carinho.',
        'A pessoa que só leva o cachorro ao veterinário quando ele adoece não deveria achar que tá tudo bem.',
        'O tutor que briga com o cachorro por fazer xixi no lugar errado não deveria esperar que ele aprenda assim.'
      ]},
      { modelId: 'serie_04', title: 'Como cuidar do teu cachorro sem gastar uma fortuna (parte 1)', parts: [
        'Manter as vacinas em dia pra evitar gastos maiores.',
        'Fazer brinquedos com o que tu tem em casa.',
        'Escovar os dentes em casa entre as consultas.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer um cachorro mais calmo em casa deveria fazer isso aqui.',
        'Quem vai adotar um filhote deveria fazer isso aqui.',
        'Quem quer que o cachorro viva mais e melhor deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'medicina',
    category: 'Saúde e Corpo',
    name: 'Medicina',
    subtitle: 'Pra quem quer cuidar da saúde antes de precisar correr pro pronto-socorro.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vive com dor de cabeça deveria fazer, mas não faz.',
        'O que toda mulher que vive cansada deveria fazer, mas não faz.',
        'O que toda pessoa que se automedica deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a fazer teus exames de rotina uma vez por ano.',
        'Comece a anotar os sintomas antes da consulta.',
        'Comece a levar a lista dos teus remédios em toda consulta.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que pesquisa os sintomas na internet não deveria acreditar no pior diagnóstico que aparece.',
        'A mulher que deixa a própria consulta pra depois dos filhos não deveria adiar a saúde dela.',
        'A pessoa que para o antibiótico quando melhora não deveria achar que já tá curada.'
      ]},
      { modelId: 'serie_04', title: 'Como cuidar da saúde sem viver no consultório (parte 1)', parts: [
        'Os exames que valem a pena fazer todo ano.',
        'Os sinais que pedem consulta logo.',
        'Organizar teus exames num lugar só.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer ter mais energia no dia a dia deveria fazer isso aqui.',
        'Quem quer aproveitar melhor a consulta deveria fazer isso aqui.',
        'Quem quer dormir melhor deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'enfermagem',
    category: 'Saúde e Corpo',
    name: 'Enfermagem',
    subtitle: 'Pra quem cuida de alguém em casa ou quer cuidar melhor de si.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que cuida de um idoso em casa deveria fazer, mas não faz.',
        'O que toda mãe deveria ter na caixinha de primeiros socorros, mas não tem.',
        'O que toda pessoa que vai fazer uma cirurgia deveria fazer antes, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a medir a pressão no mesmo horário todos os dias.',
        'Comece a organizar os remédios numa caixinha por horário.',
        'Comece a lavar as mãos antes de fazer qualquer curativo.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que passa pasta de dente na queimadura não deveria achar que tá ajudando.',
        'A filha que cuida da mãe sozinha não deveria esquecer de cuidar de si.',
        'A pessoa que tira o curativo toda hora pra olhar não deveria estranhar a demora pra cicatrizar.'
      ]},
      { modelId: 'serie_04', title: 'Como cuidar de alguém em casa sem se esgotar (parte 1)', parts: [
        'Uma rotina simples pros remédios.',
        'Dividir os cuidados com a família.',
        'Saber quando pedir ajuda profissional.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer agir rápido num engasgo deveria fazer isso aqui.',
        'Quem cuida de um idoso acamado deveria fazer isso aqui.',
        'Quem quer evitar erro com remédio deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'farmacia',
    category: 'Saúde e Corpo',
    name: 'Farmácia',
    subtitle: 'Pra quem toma remédio e quer fazer isso do jeito certo.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que toma remédio todo dia deveria fazer, mas não faz.',
        'O que toda pessoa que guarda remédio no banheiro deveria fazer, mas não faz.',
        'O que toda mãe que dá remédio pro filho deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a conferir a validade dos remédios de casa.',
        'Comece a tomar o remédio sempre no mesmo horário.',
        'Comece a perguntar ao farmacêutico como tomar o remédio novo.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que toma remédio com café não deveria achar que não faz diferença.',
        'A pessoa que divide o comprimido sem orientação não deveria achar que é tudo igual.',
        'A pessoa que guarda sobra de antibiótico pra próxima vez não deveria usar sem receita.'
      ]},
      { modelId: 'serie_04', title: 'Como tomar remédio sem esquecer nenhuma dose (parte 1)', parts: [
        'Usar o alarme do celular.',
        'Uma caixinha separada por dia da semana.',
        'Ligar o remédio a um hábito que tu já tem.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem toma vários remédios por dia deveria fazer isso aqui.',
        'Quem quer economizar na farmácia deveria fazer isso aqui.',
        'Quem quer montar uma farmacinha de casa deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'fonoaudiologia',
    category: 'Saúde e Corpo',
    name: 'Fonoaudiologia',
    subtitle: 'Pra quem quer falar melhor, cuidar da voz ou ajudar o filho a falar.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que fala o dia inteiro no trabalho deveria fazer, mas não faz.',
        'O que toda mãe de criança que ainda não fala deveria fazer, mas não faz.',
        'O que toda pessoa que fica rouca com frequência deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a beber água ao longo do dia pra cuidar da voz.',
        'Comece a ler em voz alta pro teu filho todos os dias.',
        'Comece a fazer pausas pra respirar quando fala em público.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A professora que grita pra turma prestar atenção não deveria estranhar a voz falhando no fim do dia.',
        'A mãe que fala tudo pelo filho não deveria se perguntar por que ele não pede as coisas.',
        'A pessoa que pigarreia toda hora não deveria achar que isso limpa a garganta.'
      ]},
      { modelId: 'serie_04', title: 'Como falar melhor em público sem decorar o texto (parte 1)', parts: [
        'Respirar antes de começar.',
        'Falar mais devagar do que tu acha que precisa.',
        'Usar pausas no lugar do "é...".'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer uma voz mais firme deveria fazer isso aqui.',
        'Quem quer estimular a fala do filho deveria fazer isso aqui.',
        'Quem quer parar de ficar rouca deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'estetica',
    category: 'Beleza e Estilo',
    name: 'Estética',
    subtitle: 'Pra quem quer uma pele mais uniforme com uma rotina simples.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que tem mancha no rosto deveria fazer, mas não faz.',
        'O que toda pessoa que tem pele oleosa deveria fazer, mas não faz.',
        'O que toda mulher que começou a usar ácido deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a reaplicar o protetor solar durante o dia.',
        'Comece a tirar a maquiagem antes de dormir, mesmo cansada.',
        'Comece a trocar a fronha do travesseiro toda semana.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que usa dez produtos no rosto não deveria achar que mais é sempre melhor.',
        'A pessoa que espreme espinha não deveria estranhar a mancha que fica depois.',
        'A mulher que só usa protetor na praia não deveria se perguntar de onde veio a mancha.'
      ]},
      { modelId: 'serie_04', title: 'Como cuidar da pele sem gastar com dez produtos (parte 1)', parts: [
        'Uma rotina com só 3 passos.',
        'Escolher o protetor certo pro teu tipo de pele.',
        'Usar o hidratante do jeito certo.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer clarear manchas deveria fazer isso aqui.',
        'Quem quer uma pele com menos oleosidade deveria fazer isso aqui.',
        'Quem quer uma rotina de skincare que caiba no dia deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'maquiagem',
    category: 'Beleza e Estilo',
    name: 'Maquiagem',
    subtitle: 'Pra quem quer se arrumar rápido e se sentir bonita.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que acha que não sabe se maquiar deveria fazer, mas não faz.',
        'O que toda pessoa com pele oleosa deveria fazer antes da base, mas não faz.',
        'O que toda noiva que vai se maquiar sozinha deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a aplicar a base em camadas finas.',
        'Comece a escolher o batom pelo teu tom de pele.',
        'Comece a lavar teus pincéis toda semana.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que só tem 5 minutos de manhã não deveria tentar fazer uma maquiagem de festa.',
        'A pessoa que escolhe a base pelo tom do braço não deveria estranhar o rosto de outra cor.',
        'A mãe que nunca tem tempo pra se arrumar não deveria achar que maquiagem não é pra ela.'
      ]},
      { modelId: 'serie_04', title: 'Como se maquiar sem gastar meia hora (parte 1)', parts: [
        'Uma make com só 3 produtos.',
        'Usar o mesmo produto na boca e na bochecha.',
        'A ordem certa pra não precisar refazer nada.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer uma make que dura o dia inteiro deveria fazer isso aqui.',
        'Quem quer parecer descansada mesmo dormindo pouco deveria fazer isso aqui.',
        'Quem quer aprender a se maquiar do zero deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'cabeleireira',
    category: 'Beleza e Estilo',
    name: 'Cabeleireira',
    subtitle: 'Pra quem quer um cabelo bonito e saudável.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher em transição capilar deveria fazer, mas não faz.',
        'O que toda pessoa de cabelo cacheado deveria fazer depois do banho, mas não faz.',
        'O que toda mãe de criança cacheada deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a secar o cabelo com uma camiseta de algodão.',
        'Comece a dormir com o cabelo preso no alto da cabeça.',
        'Comece a desembaraçar o cabelo ainda com o condicionador.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que penteia o cacho seco não deveria se assustar com o volume.',
        'A pessoa que lava o cabelo todo dia não deveria achar que o ressecamento é genético.',
        'A mulher que mexe no cabelo enquanto ele seca não deveria estranhar o frizz.'
      ]},
      { modelId: 'serie_04', title: 'Como definir os cachos sem gastar com muito produto (parte 1)', parts: [
        'A quantidade certa de creme pro teu volume.',
        'Finalizar com o cabelo ainda molhado.',
        'Usar o difusor do jeito certo.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer acordar com o cacho bonito deveria fazer isso aqui.',
        'Quem quer passar pela transição sem desistir deveria fazer isso aqui.',
        'Quem quer menos frizz em dia úmido deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'consultoria_estilo',
    category: 'Beleza e Estilo',
    name: 'Consultoria de estilo',
    subtitle: 'Pra quem tem o armário cheio e sente que não tem nada pra vestir.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que sente que não tem roupa deveria fazer, mas não faz.',
        'O que toda pessoa que compra roupa em promoção deveria fazer, mas não faz.',
        'O que toda mulher que voltou a trabalhar presencial deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a montar o look da semana no domingo.',
        'Comece a fotografar os looks que tu gostou de usar.',
        'Comece a doar uma peça a cada peça nova que entra.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que compra roupa pra quando emagrecer não deveria deixar de se vestir bem agora.',
        'A pessoa que só usa preto pra não errar não deveria achar que não tem estilo.',
        'A mulher que guarda a roupa bonita pra uma ocasião especial não deveria esperar tanto.'
      ]},
      { modelId: 'serie_04', title: 'Como se vestir melhor sem comprar roupa nova (parte 1)', parts: [
        'Combinar uma peça de 3 jeitos diferentes.',
        'Usar acessório pra mudar o look inteiro.',
        'Ajustar a barra e a cintura de peças que tu já tem.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer parar de perder tempo escolhendo roupa deveria fazer isso aqui.',
        'Quem quer parecer mais elegante no trabalho deveria fazer isso aqui.',
        'Quem quer um guarda-roupa que combina deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'nail_designer',
    category: 'Beleza e Estilo',
    name: 'Nail designer',
    subtitle: 'Pra quem quer unhas bonitas e que duram mais.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que faz alongamento de unha deveria fazer, mas não faz.',
        'O que toda pessoa que tem unha fraca deveria fazer, mas não faz.',
        'O que toda manicure que tá começando deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a usar luva pra lavar a louça.',
        'Comece a hidratar a cutícula todos os dias.',
        'Comece a lixar a unha sempre na mesma direção.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que tira o esmalte em gel em casa raspando não deveria estranhar a unha fina depois.',
        'A pessoa que usa a unha como ferramenta não deveria se perguntar por que ela quebra.',
        'A mulher que tira toda a cutícula não deveria achar que é só estética.'
      ]},
      { modelId: 'serie_04', title: 'Como fazer o esmalte durar mais sem precisar de gel (parte 1)', parts: [
        'Aplicar camadas finas.',
        'Passar a base e o extra brilho do jeito certo.',
        'Retocar o extra brilho no meio da semana.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer unha comprida e forte deveria fazer isso aqui.',
        'Quem quer que o alongamento dure mais deveria fazer isso aqui.',
        'Quem quer fazer a unha em casa deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'designer_sobrancelhas',
    category: 'Beleza e Estilo',
    name: 'Designer de sobrancelhas',
    subtitle: 'Pra quem quer sobrancelhas bonitas e naturais.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mulher que tira a sobrancelha em casa deveria fazer, mas não faz.',
        'O que toda pessoa que quer fazer micropigmentação deveria fazer antes, mas não faz.',
        'O que toda mulher com sobrancelha falhada deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a pentear a sobrancelha antes de preencher.',
        'Comece a deixar crescer antes da próxima design.',
        'Comece a escolher o lápis um tom mais claro que o cabelo.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mulher que afina a sobrancelha toda semana não deveria estranhar quando ela para de crescer.',
        'A pessoa que copia a sobrancelha da blogueira não deveria esquecer que o rosto dela é diferente.',
        'A mulher que preenche a sobrancelha toda com a mesma força não deveria se perguntar por que ficou artificial.'
      ]},
      { modelId: 'serie_04', title: 'Como ter a sobrancelha bonita sem precisar preencher todo dia (parte 1)', parts: [
        'Respeitar o desenho natural.',
        'Usar gel fixador.',
        'Fazer a manutenção no tempo certo.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer a sobrancelha mais cheia deveria fazer isso aqui.',
        'Quem quer um rosto mais harmônico deveria fazer isso aqui.',
        'Quem vai fazer a primeira micropigmentação deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'advocacia',
    category: 'Direito e Finanças',
    name: 'Advocacia',
    subtitle: 'Pra quem quer conhecer seus direitos antes de precisar deles.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vai se divorciar deveria fazer, mas não faz.',
        'O que toda gestante que trabalha de carteira assinada deveria fazer, mas não faz.',
        'O que todo casal que vai morar junto deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a guardar os comprovantes de gastos com teus filhos.',
        'Comece a anotar os horários que tu realmente trabalha.',
        'Comece a entender qual é o regime de bens do teu casamento.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mãe que combina a pensão só de boca não deveria se surpreender quando o pagamento atrasa.',
        'A funcionária que responde o chefe no WhatsApp à noite não deveria achar que isso é normal.',
        'O casal que mora junto há anos sem formalizar não deveria achar que tá tudo garantido.'
      ]},
      { modelId: 'serie_04', title: 'Como se separar sem transformar tudo em briga (parte 1)', parts: [
        'Organizar os documentos antes da primeira conversa.',
        'Entender quando dá pra fazer um acordo.',
        'Separar o que é dos filhos do que é do casal.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer garantir a pensão em dia deveria fazer isso aqui.',
        'Quem tá grávida e trabalha de carteira assinada deveria fazer isso aqui.',
        'Quem vai casar e quer evitar problema lá na frente deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'contabilidade',
    category: 'Direito e Finanças',
    name: 'Contabilidade',
    subtitle: 'Pra quem empreende e quer pagar menos imposto sem dor de cabeça.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que todo MEI deveria fazer todo mês, mas não faz.',
        'O que toda pessoa que vai abrir empresa deveria fazer, mas não faz.',
        'O que toda empreendedora que vende pela internet deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a separar a conta da empresa da tua conta pessoal.',
        'Comece a definir um pró-labore fixo.',
        'Comece a emitir nota fiscal de todas as vendas.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A empreendedora que paga as contas de casa com o dinheiro da empresa não deveria achar que o negócio não dá lucro.',
        'O MEI que esquece de pagar o DAS não deveria deixar acumular.',
        'A pessoa que fatura acima do limite do MEI não deveria esperar o ano acabar pra resolver.'
      ]},
      { modelId: 'serie_04', title: 'Como organizar as finanças da empresa sem planilha complicada (parte 1)', parts: [
        'Duas contas: uma da empresa e uma tua.',
        'Anotar entrada e saída uma vez por semana.',
        'Separar uma porcentagem pros impostos.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer pagar menos imposto de forma legal deveria fazer isso aqui.',
        'Quem quer saber se o negócio dá lucro deveria fazer isso aqui.',
        'Quem quer sair do MEI sem susto deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'consultoria_financeira',
    category: 'Direito e Finanças',
    name: 'Consultoria financeira',
    subtitle: 'Pra quem chega no fim do mês sem saber pra onde foi o salário.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vive no cheque especial deveria fazer, mas não faz.',
        'O que toda mulher que quer juntar dinheiro deveria fazer, mas não faz.',
        'O que todo casal que divide as contas deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a separar uma parte do salário assim que ele cai na conta.',
        'Comece a revisar as assinaturas que tu nem usa mais.',
        'Comece a anotar os gastos pequenos do dia.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que parcela tudo no cartão não deveria se assustar com a fatura.',
        'A mulher que só guarda o que sobra não deveria estranhar quando nunca sobra nada.',
        'A pessoa que compra pra aliviar o estresse não deveria achar que o problema é o salário.'
      ]},
      { modelId: 'serie_04', title: 'Como juntar dinheiro sem cortar tudo que tu gosta (parte 1)', parts: [
        'Um valor fixo pro lazer sem culpa.',
        'Uma reserva pros gastos de fim de ano.',
        'Acompanhar os gastos da semana em 5 minutos.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer sair das dívidas deveria fazer isso aqui.',
        'Quem quer montar uma reserva de emergência deveria fazer isso aqui.',
        'Quem quer viajar sem se endividar deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'corretora_imoveis',
    category: 'Casa e Imóveis',
    name: 'Corretora de imóveis',
    subtitle: 'Pra quem sonha em sair do aluguel.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que quer comprar a primeira casa deveria fazer, mas não faz.',
        'O que todo casal que vai financiar um apartamento deveria fazer, mas não faz.',
        'O que toda pessoa que paga aluguel há anos deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a simular o financiamento antes de visitar imóveis.',
        'Comece a juntar o dinheiro da entrada numa conta separada.',
        'Comece a organizar teus documentos pro banco.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que se apaixona pelo apartamento antes de ver se consegue pagar não deveria se frustrar depois.',
        'O casal que olha só o valor da parcela não deveria esquecer dos custos da compra.',
        'A pessoa que acha que nunca vai conseguir comprar não deveria descartar o financiamento sem simular.'
      ]},
      { modelId: 'serie_04', title: 'Como comprar teu primeiro apartamento sem perder tempo (parte 1)', parts: [
        'Definir 3 características indispensáveis antes de buscar.',
        'Conferir a documentação do imóvel antes da visita.',
        'Comparar as taxas de mais de um banco.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer sair do aluguel deveria fazer isso aqui.',
        'Quem quer usar o FGTS na compra deveria fazer isso aqui.',
        'Quem quer comprar imóvel na planta deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'arquitetura',
    category: 'Casa e Imóveis',
    name: 'Arquitetura',
    subtitle: 'Pra quem quer uma casa bonita e funcional em poucos metros.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que mora em apartamento pequeno deveria fazer, mas não faz.',
        'O que toda pessoa que vai reformar deveria fazer, mas não faz.',
        'O que todo casal que vai mobiliar o primeiro apartamento deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a medir o espaço antes de comprar qualquer móvel.',
        'Comece a usar espelho pra ampliar a sala.',
        'Comece a pensar na iluminação antes da decoração.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que compra um sofá enorme pra uma sala pequena não deveria estranhar a falta de espaço.',
        'A pessoa que pinta todas as paredes de escuro não deveria se perguntar por que a casa parece menor.',
        'A pessoa que reforma sem projeto não deveria se assustar com o orçamento estourado.'
      ]},
      { modelId: 'serie_04', title: 'Como deixar a casa mais bonita sem reformar (parte 1)', parts: [
        'Trocar as lâmpadas por luz amarela nos ambientes de descanso.',
        'Pendurar as cortinas mais alto.',
        'Usar tapete pra dividir os ambientes.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer que a casa pareça maior deveria fazer isso aqui.',
        'Quem quer reformar sem estourar o orçamento deveria fazer isso aqui.',
        'Quem quer uma sala mais aconchegante deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'personal_organizer',
    category: 'Casa e Imóveis',
    name: 'Personal organizer',
    subtitle: 'Pra quem arruma a casa e no dia seguinte tá tudo bagunçado de novo.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vive arrumando a casa deveria fazer, mas não faz.',
        'O que toda mãe que tem a casa cheia de brinquedo deveria fazer, mas não faz.',
        'O que toda pessoa que vai se mudar deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a guardar as coisas onde tu usa.',
        'Comece a arrumar a casa 10 minutos por dia.',
        'Comece a ter um lugar fixo pras chaves e documentos.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que compra caixa organizadora antes de desapegar não deveria estranhar a bagunça organizada.',
        'A mulher que arruma a casa sozinha não deveria achar que a família não consegue ajudar.',
        'A pessoa que guarda tudo porque um dia pode usar não deveria se perguntar por que falta espaço.'
      ]},
      { modelId: 'serie_04', title: 'Como organizar a casa sem gastar com organizador (parte 1)', parts: [
        'Usar caixas de sapato nas gavetas.',
        'Dobrar as roupas em pé.',
        'Reaproveitar potes de vidro na despensa.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer um guarda-roupa que fica arrumado deveria fazer isso aqui.',
        'Quem quer a cozinha organizada deveria fazer isso aqui.',
        'Quem quer parar de perder as coisas em casa deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'engenharia',
    category: 'Casa e Imóveis',
    name: 'Engenharia',
    subtitle: 'Pra quem vai construir ou reformar e não quer dor de cabeça.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vai construir a casa própria deveria fazer, mas não faz.',
        'O que toda pessoa que vai reformar o apartamento deveria fazer antes, mas não faz.',
        'O que toda pessoa que compra um terreno deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a pedir mais de um orçamento antes de fechar a obra.',
        'Comece a registrar a obra com fotos de cada etapa.',
        'Comece a separar uma reserva pros imprevistos da obra.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que começa a obra sem projeto não deveria se assustar quando o orçamento estoura.',
        'A pessoa que contrata pedreiro pelo menor preço não deveria estranhar o retrabalho.',
        'A pessoa que derruba parede sem consultar ninguém não deveria achar que é só uma parede.'
      ]},
      { modelId: 'serie_04', title: 'Como construir sem estourar o orçamento (parte 1)', parts: [
        'Fechar o projeto antes de comprar material.',
        'Comprar o material na fase certa da obra.',
        'Acompanhar a obra com um cronograma simples.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer construir a casa própria deveria fazer isso aqui.',
        'Quem quer evitar infiltração deveria fazer isso aqui.',
        'Quem quer reformar com o apartamento ocupado deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'confeitaria',
    category: 'Negócios e Serviços',
    name: 'Confeitaria',
    subtitle: 'Pra quem quer vender doces e bolos feitos em casa.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda confeiteira que tá começando deveria fazer, mas não faz.',
        'O que toda pessoa que vende bolo por encomenda deveria fazer, mas não faz.',
        'O que toda confeiteira que cobra barato deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a pesar os ingredientes em vez de medir em xícara.',
        'Comece a calcular o custo de cada receita.',
        'Comece a fotografar teus bolos na luz natural.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A confeiteira que cobra pelo preço da vizinha não deveria se surpreender quando não sobra nada.',
        'A pessoa que aceita todo pedido de última hora não deveria estranhar o cansaço.',
        'A confeiteira que muda a receita toda vez não deveria se perguntar por que o bolo nunca sai igual.'
      ]},
      { modelId: 'serie_04', title: 'Como fazer um bolo fofinho sem errar a receita (parte 1)', parts: [
        'A temperatura certa dos ingredientes.',
        'Não abrir o forno antes da hora.',
        'Peneirar a farinha antes de misturar.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer começar a vender bolo em casa deveria fazer isso aqui.',
        'Quem quer cobrar o preço certo deveria fazer isso aqui.',
        'Quem quer ter encomendas o mês inteiro deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'fotografia',
    category: 'Negócios e Serviços',
    name: 'Fotografia',
    subtitle: 'Pra empreendedoras que fotografam os próprios produtos.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda empreendedora que fotografa os próprios produtos deveria fazer, mas não faz.',
        'O que toda pessoa que vende roupa pelo Instagram deveria fazer, mas não faz.',
        'O que toda pessoa que acha que precisa de câmera profissional deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a fotografar de frente pra janela.',
        'Comece a limpar a lente do celular antes de cada foto.',
        'Comece a usar um fundo neutro nas fotos de produto.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A empreendedora que fotografa à noite com a luz do teto não deveria achar que o problema é o celular.',
        'A pessoa que usa filtro pesado nas fotos não deveria estranhar quando o cliente reclama da cor.',
        'A pessoa que tira só uma foto do produto não deveria esperar que ela mostre tudo.'
      ]},
      { modelId: 'serie_04', title: 'Como tirar fotos bonitas sem comprar equipamento (parte 1)', parts: [
        'Usar uma folha branca pra rebater a luz.',
        'Criar um cenário com o que tu tem em casa.',
        'Usar o modo retrato do jeito certo.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer vender mais pelo Instagram deveria fazer isso aqui.',
        'Quem quer fotos com cara de profissional deveria fazer isso aqui.',
        'Quem quer um feed mais bonito deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'social_media',
    category: 'Negócios e Serviços',
    name: 'Social media',
    subtitle: 'Pra donas de negócio que querem vender pelo Instagram.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda dona de loja física deveria postar, mas não posta.',
        'O que todo pequeno negócio deveria fazer nos stories, mas não faz.',
        'O que toda empreendedora que posta só foto de produto deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a mostrar os bastidores do teu negócio.',
        'Comece a responder as perguntas dos clientes em vídeo.',
        'Comece a postar o mesmo produto de jeitos diferentes.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A empreendedora que só posta quando lembra não deveria estranhar quando o perfil não cresce.',
        'A dona de negócio que só fala do preço não deveria se perguntar por que o cliente compara com a concorrência.',
        'A pessoa que copia o post do concorrente não deveria esperar ser lembrada.'
      ]},
      { modelId: 'serie_04', title: 'Como vender pelo Instagram sem parecer chata (parte 1)', parts: [
        'Contar a história por trás do produto.',
        'Mostrar o cliente usando.',
        'Responder dúvidas em vez de anunciar.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer vender mais pelo direct deveria fazer isso aqui.',
        'Quem quer atrair cliente da própria cidade deveria fazer isso aqui.',
        'Quem quer postar todo dia sem ficar sem ideia deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'gastronomia',
    category: 'Negócios e Serviços',
    name: 'Gastronomia',
    subtitle: 'Pra quem quer cozinhar melhor e com menos tempo.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que cozinha todo dia deveria fazer, mas não faz.',
        'O que toda pessoa que joga comida fora deveria fazer, mas não faz.',
        'O que toda pessoa que acha que não sabe cozinhar deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a cortar todos os ingredientes antes de ligar o fogo.',
        'Comece a temperar a carne com antecedência.',
        'Comece a aproveitar os talos e as cascas.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que lota a frigideira de carne não deveria estranhar quando ela cozinha em vez de dourar.',
        'A pessoa que mexe o arroz toda hora não deveria se perguntar por que ele empapa.',
        'A pessoa que cozinha todo dia do zero não deveria achar que não tem como ganhar tempo.'
      ]},
      { modelId: 'serie_04', title: 'Como cozinhar a semana inteira sem passar o domingo na cozinha (parte 1)', parts: [
        'Deixar as bases prontas: arroz, feijão e um molho.',
        'Congelar porções do jeito certo.',
        'Usar a mesma proteína em pratos diferentes.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer comer bem gastando pouco deveria fazer isso aqui.',
        'Quem quer uma carne suculenta deveria fazer isso aqui.',
        'Quem quer levar marmita pro trabalho deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'design_grafico',
    category: 'Negócios e Serviços',
    name: 'Design gráfico',
    subtitle: 'Pra empreendedoras que querem uma marca com cara profissional.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda empreendedora que faz a própria arte deveria fazer, mas não faz.',
        'O que toda marca pequena deveria ter, mas não tem.',
        'O que toda pessoa que vai criar um logo deveria fazer antes, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a usar no máximo duas fontes nas tuas artes.',
        'Comece a definir as cores da tua marca.',
        'Comece a deixar mais espaço em branco nos teus posts.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A empreendedora que muda a cor da marca todo mês não deveria estranhar quando ninguém reconhece ela.',
        'A pessoa que coloca muito texto na arte não deveria se perguntar por que ninguém lê.',
        'A pessoa que pede um logo sem saber o que quer não deveria se frustrar com o resultado.'
      ]},
      { modelId: 'serie_04', title: 'Como deixar teus posts mais bonitos sem saber design (parte 1)', parts: [
        'Usar uma paleta de três cores.',
        'Alinhar tudo pelo mesmo lado.',
        'Deixar o texto mais importante maior.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer uma marca com cara profissional deveria fazer isso aqui.',
        'Quem quer um feed que chama atenção deveria fazer isso aqui.',
        'Quem quer fazer a própria arte no Canva deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'agencia_viagens',
    category: 'Negócios e Serviços',
    name: 'Agência de viagens',
    subtitle: 'Pra quem quer viajar mais, gastando menos e sem perrengue.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que vai viajar pra fora pela primeira vez deveria fazer, mas não faz.',
        'O que toda família que viaja com criança deveria fazer, mas não faz.',
        'O que toda pessoa que compra passagem de última hora deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a pesquisar passagem com antecedência.',
        'Comece a fazer seguro viagem mesmo pra viagens curtas.',
        'Comece a montar o roteiro antes de reservar o hotel.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que leva a mala cheia não deveria estranhar quando paga excesso de bagagem.',
        'A pessoa que reserva o hotel mais barato longe de tudo não deveria achar que economizou.',
        'A família que viaja sem roteiro com criança não deveria se surpreender com o cansaço.'
      ]},
      { modelId: 'serie_04', title: 'Como viajar mais sem gastar mais (parte 1)', parts: [
        'Escolher a baixa temporada.',
        'Juntar milhas no cartão do dia a dia.',
        'Montar um roteiro por regiões da cidade.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer conhecer a Europa deveria fazer isso aqui.',
        'Quem quer viajar com os filhos sem estresse deveria fazer isso aqui.',
        'Quem quer fazer a mala só de mão deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'professora_ingles',
    category: 'Educação e Família',
    name: 'Professora de inglês',
    subtitle: 'Pra quem estuda há anos e ainda trava na hora de falar.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que trava na hora de falar inglês deveria fazer, mas não faz.',
        'O que todo adulto que quer aprender inglês do zero deveria fazer, mas não faz.',
        'O que toda pessoa que vai viajar pra fora deveria fazer antes, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a pensar em inglês nas tarefas do teu dia.',
        'Comece a assistir série com a legenda em inglês.',
        'Comece a gravar áudios curtos falando em inglês.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que estuda gramática há anos não deveria achar que vai falar sem treinar a fala.',
        'O adulto que acha que já passou da idade não deveria desistir antes de tentar.',
        'A pessoa que traduz tudo na cabeça não deveria estranhar a demora pra responder.'
      ]},
      { modelId: 'serie_04', title: 'Como aprender inglês sem decorar regra de gramática (parte 1)', parts: [
        'Aprender frases inteiras, não palavras soltas.',
        'Repetir as falas da tua série favorita.',
        'Mudar o idioma do celular.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer perder o medo de falar inglês deveria fazer isso aqui.',
        'Quem quer passar numa entrevista em inglês deveria fazer isso aqui.',
        'Quem quer entender filme sem legenda deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'educacao_parental',
    category: 'Educação e Família',
    name: 'Educação parental',
    subtitle: 'Pra mães e pais que querem educar com mais calma.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mãe que vive gritando com o filho deveria fazer, mas não faz.',
        'O que todo pai que tem filho que não dorme deveria fazer, mas não faz.',
        'O que toda mãe de criança que não larga o celular deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a avisar teu filho antes de mudar de atividade.',
        'Comece a dar duas opções em vez de uma ordem.',
        'Comece a criar uma rotina previsível pra hora de dormir.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mãe que cede à birra pra acabar logo não deveria estranhar quando ela volta mais forte.',
        'A mãe que usa o celular pra acalmar o filho não deveria se surpreender quando ele só se acalma assim.',
        'O pai que só aparece pra dar bronca não deveria achar que o filho não respeita ele.'
      ]},
      { modelId: 'serie_04', title: 'Como colocar limite sem precisar gritar (parte 1)', parts: [
        'Abaixar na altura da criança pra falar.',
        'Nomear o que ela tá sentindo.',
        'Combinar as regras antes, não na hora da briga.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer menos birra em casa deveria fazer isso aqui.',
        'Quem quer que o filho durma sozinho deveria fazer isso aqui.',
        'Quem quer diminuir o tempo de tela do filho deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'pedagogia',
    category: 'Educação e Família',
    name: 'Pedagogia',
    subtitle: 'Pra mães e professoras que querem ajudar as crianças a aprender.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda mãe de criança em alfabetização deveria fazer, mas não faz.',
        'O que toda mãe que ajuda o filho na lição de casa deveria fazer, mas não faz.',
        'O que toda professora em início de carreira deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a ler com teu filho antes de dormir.',
        'Comece a deixar teu filho tentar sozinho antes de ajudar.',
        'Comece a criar um cantinho fixo pra lição de casa.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A mãe que faz a lição pelo filho não deveria estranhar quando ele não aprende.',
        'A mãe que compara o filho com o primo não deveria achar que isso motiva.',
        'A professora que tenta controlar a turma gritando não deveria se perguntar por que ninguém escuta.'
      ]},
      { modelId: 'serie_04', title: 'Como ajudar teu filho a aprender sem virar professora dele (parte 1)', parts: [
        'Aprender brincando com o que tem em casa.',
        'Usar o mercado pra ensinar matemática.',
        'Elogiar o esforço, não só a nota.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer que o filho goste de ler deveria fazer isso aqui.',
        'Quem quer menos briga na hora da lição deveria fazer isso aqui.',
        'Quem quer ajudar na alfabetização deveria fazer isso aqui.'
      ]}
    ]
  },
  {
    id: 'recursos_humanos',
    category: 'Educação e Família',
    name: 'Recursos humanos',
    subtitle: 'Pra quem quer um emprego novo ou crescer na carreira.',
    series: [
      { modelId: 'serie_01', title: 'O que todo mundo deveria fazer, mas não faz', parts: [
        'O que toda pessoa que tá procurando emprego deveria fazer, mas não faz.',
        'O que toda pessoa que vai pra uma entrevista deveria fazer antes, mas não faz.',
        'O que toda pessoa que quer uma promoção deveria fazer, mas não faz.'
      ]},
      { modelId: 'serie_02', title: 'Comece a...', parts: [
        'Comece a adaptar teu currículo pra cada vaga.',
        'Comece a deixar teu LinkedIn atualizado.',
        'Comece a anotar teus resultados no trabalho.'
      ]},
      { modelId: 'serie_03', title: 'A pessoa que...', parts: [
        'A pessoa que manda o mesmo currículo pra todas as vagas não deveria estranhar quando ninguém chama.',
        'A pessoa que fala mal do emprego antigo na entrevista não deveria se perguntar por que não passou.',
        'A pessoa que espera ser lembrada pra promoção não deveria achar que o chefe vai adivinhar.'
      ]},
      { modelId: 'serie_04', title: 'Como conseguir uma entrevista sem ter indicação (parte 1)', parts: [
        'Escrever um resumo que chama atenção.',
        'Usar as palavras da vaga no currículo.',
        'Falar com quem trabalha na empresa.'
      ]},
      { modelId: 'serie_05', title: 'Quem quer... deveria fazer isso aqui', parts: [
        'Quem quer passar na entrevista deveria fazer isso aqui.',
        'Quem quer mudar de área deveria fazer isso aqui.',
        'Quem quer pedir aumento deveria fazer isso aqui.'
      ]}
    ]
  }
];

export const EXTRA_1_FAQ = [
  {
    num: 1,
    question: '"E se ninguém assistir?"',
    why: 'Esse medo não tem nada a ver com tua série — é medo de validação ("então não sou boa"). As primeiras 5–10 partes quase sempre têm pouca visualização; o algoritmo trabalha em tempo, não em sorte.',
    actions: [
      'Posta sem olhar a métrica: liga o "modo robô" (criou, gravou, postou, fechou o app).',
      'Combina contigo: vou postar 7 partes seguidas SEM olhar visualização. Só na parte 8 eu olho.',
      'Se ninguém assistir mesmo, vira informação: ajusta o recheio da série ou troca o modelo.'
    ],
    reminder: 'Quem para nesse momento nunca chega no momento em que começa a funcionar.'
  },
  {
    num: 2,
    question: '"Tô com vergonha de aparecer / da minha voz / do meu cenário"',
    why: 'Você se julga com olhos de crítica que não usa para ninguém. Sua voz na gravação é a voz real que todos sempre ouviram, e seu cenário cotidiano é só "casa de gente" para quem assiste.',
    actions: [
      'Voz: grave 1 áudio no WhatsApp e escute várias vezes para se acostumar.',
      'Cenário: escolha UM cantinho da casa (parede, sofá, mesa) e repita sempre. Repetição vira identidade.',
      'Aparência: filme um Reels teste 5 vezes seguidas sem postar — na quinta você foca no conteúdo.'
    ],
    reminder: 'O que você acha "estranho" em você, o público nem percebe. Eles ouvem o que você fala.'
  },
  {
    num: 3,
    question: '"Achei que a parte 1 ficou mediana, posto ou refaço?"',
    why: 'Perfeccionismo é medo disfarçado. Sua parte 1 nunca será tão boa quanto a parte 30 porque você evolui gravando e vendo a reação real, não pensando em gravar.',
    actions: [
      'Aplique o Filtro 70%: se está pelo menos 70% bom, POSTA. Os outros 30% vêm nas próximas partes.',
      'Defina um prazo fixo de gravação ("vou gravar hoje e postar amanhã, sem adiar").',
      'Aceite que na parte 5 você vai olhar a parte 1 com vergonha — isso é sinal de evolução.'
    ],
    reminder: 'Feito e postado hoje gera dados; perfeito na gaveta gera zero.'
  },
  {
    num: 4,
    question: '"Será que meu nicho é fraco demais?"',
    why: 'Não existe nicho fraco, existe forma fraca de falar dele. Nicho específico tem público fiel; nicho amplo tem público disperso.',
    actions: [
      'Busque uma palavra-chave do seu nicho no Instagram: se há perfis grandes, há demanda.',
      'Se há poucos perfis grandes, melhor ainda: pioneirismo é vantagem.',
      'Lembre de quem te pede conselhos no WhatsApp — se alguém pergunta, existe público.'
    ],
    reminder: 'Nicho fraco é desculpa. Coragem de postar é o ativo real.'
  },
  {
    num: 5,
    question: '"Postei e ninguém viu, devo desistir?"',
    why: 'O algoritmo precisa entender quem você é e para quem entregar. Isso leva de 7 a 15 partes consistentes numa série.',
    actions: [
      'Não desista antes da Parte 15 — esse é o piso mínimo.',
      'Pare de olhar métricas nas primeiras 24h; avalie só após 3 a 5 dias.',
      'Se na Parte 15 não engrenar, revise a entrega e o gancho (itens 6 e 8).'
    ],
    reminder: 'Desistir antes da parte 15 é sair de uma corrida na largada.'
  },
  {
    num: 6,
    question: '"Tô na parte 5 e travei, não tenho mais ideia"',
    why: 'O cérebro não cria do vácuo, ele reorganiza matéria-prima. Travar significa falta de repertório de dúvidas reais entrando no sistema.',
    actions: [
      'Use o Radar de Temas Quentes (Aba 2) ou consulte os exemplos do modelo escolhido.',
      'Vasculhe comentários do seu perfil e de concorrentes ("e no meu caso...", "mas e quando...").',
      'Transforme toda dúvida do WhatsApp, Direct e atendimento da semana em um episódio.'
    ],
    reminder: 'As dúvidas que seus clientes já te fazem todo dia são seu banco infinito de partes.'
  },
  {
    num: 7,
    question: '"As partes estão ficando parecidas demais, sinto que tô repetindo"',
    why: 'Você lê e edita o roteiro dezenas de vezes; quem assiste vê uma parte por dia no meio de centenas de Reels. Para eles, não é repetitivo — é reconhecível.',
    actions: [
      'Compare sua parte com Reels aleatórios do feed, não entre suas próprias partes.',
      'Confie no silêncio do público: se ninguém reclamou, continue.',
      'NÃO mude o formato que está funcionando — consistência de estrutura é o ativo da série.'
    ],
    reminder: 'Repetir o formato faz a série ser reconhecida; mudar o conteúdo entrega valor novo.'
  },
  {
    num: 8,
    question: '"Meu gancho funcionou na parte 1 e 2, agora não pega mais"',
    why: 'Gancho bom sem entrega forte atrás vira barulho. Nas primeiras partes você soltou suas melhores dicas; depois a entrega pode ter enfraquecido.',
    actions: [
      'Responda às 3 perguntas antes de gravar: Problema real, O que aprende, O que muda na vida.',
      'Compare a entrega da Parte 1 com sua última parte lendo em voz alta.',
      'Não tente salvar entrega fraca com edição mirabolante — refaça a entrega no Clube de Análise.'
    ],
    reminder: 'Gancho não segura vídeo quando não tem conteúdo útil atrás dele.'
  },
  {
    num: 9,
    question: '"Postei e ganhei comentário ruim, perdi a vontade"',
    why: 'Viés de negatividade: o cérebro dá peso 5x maior à dor do que a dezenas de visualizações silenciosas. Comentário tóxico vem de quem rolou 2 segundos e não é seu público.',
    actions: [
      'Não responda no calor — responder no impulso entrega o vídeo para mais gente.',
      'Apague, ignore ou bloqueie sem culpa: é higiene mental.',
      'Não tome nenhuma decisão sobre a série nas próximas 24 horas.'
    ],
    reminder: 'Quem te ataca de graça nunca foi e nunca será teu cliente.'
  },
  {
    num: 10,
    question: '"Minha série bombou, e agora? Como mantenho?"',
    why: 'A "síndrome do bombou" faz você comparar todos os vídeos novos com o pico viral e tentar copiar a fórmula exata daquela parte.',
    actions: [
      'Não tente replicar a parte que bombou — continue entregando temas sólidos e variados.',
      'Aceite que picos virais acontecem em ~10% das partes; os vídeos sólidos mantêm o perfil.',
      'Foque na constância da próxima parte, não no pico passado.'
    ],
    reminder: 'É a consistência da série que sustenta a audiência, não um vídeo isolado.'
  },
  {
    num: 11,
    question: '"Tô com medo de perder o ritmo se eu parar uns dias"',
    why: 'O algoritmo tolera pausas planejadas; o que ele penaliza é inconsistência caótica (sumir semanas sem planejamento) ou conteúdo exausto.',
    actions: [
      'Grave em lote (4 a 5 Reels de uma vez usando o Teleprompter do app) para ter reserva.',
      'Nunca troque qualidade por exaustão.'
    ],
    reminder: 'Parar de propósito é estratégia. Parar por exaustão é colapso.'
  },
  {
    num: 12,
    question: '"Quando é hora de encerrar a série e começar outra?"',
    why: 'Série tem ciclo. Quando você já esgotou o tema e toda nova ideia parece forçada, encerrar com 30 partes é um case de sucesso.',
    actions: [
      'Tente listar 7 assuntos novos usando comentários e dúvidas. Se nenhum empolgar, encerre.',
      'Apenas pare a série antiga e comece uma nova com outro dos 5 modelos (sem despedida formal).'
    ],
    reminder: 'Começar uma série nova não é trair a antiga — é evoluir.'
  },
  {
    num: 13,
    question: '"Tá vindo gente nova, devo refazer as primeiras partes que tão fracas?"',
    why: 'Ver suas partes antigas mais travadas mostra para quem chega agora a sua evolução real e cria conexão.',
    actions: [
      'Não refaça — a menos que exista uma informação técnica ERRADA ou desatualizada.',
      'Fixe as partes mais novas e melhores no topo do perfil.',
      'Use sua evolução como tema de um novo vídeo ("olhei minha parte 1 hoje e...").'
    ],
    reminder: 'Refazer apaga a prova da sua evolução.'
  },
  {
    num: 14,
    question: '"Tô sem inspiração mesmo com tudo funcionando"',
    why: 'Excesso de consumo digital (horas vendo Reels, comentários e métricas) gera ruído mental, não falta de criatividade.',
    actions: [
      'Pare de consumir Reels por 48 horas e volte a fontes offline (conversas, livros, rua).',
      'Anote observações reais fora das telas — quase sempre o próximo episódio nasce ali.'
    ],
    reminder: 'Tire o excesso de ruído que a inspiração aparece sozinha.'
  }
];
