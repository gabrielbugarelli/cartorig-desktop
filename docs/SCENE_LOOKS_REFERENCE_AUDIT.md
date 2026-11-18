# CartoRig Scene Looks — avaliação individual das 27 referências

**Origem:** `maps.zip`. **Resultado:** 27 perfis editoriais, 9 looks nativos preservados, 36 presets ao todo.

Os arquivos de referência não são bases GIS nem texturas georreferenciadas. As receitas usam cores, texturas locais e o novo controle de tonalização apenas da superfície terrestre (land tint), sem inventar dados geográficos; elementos particulares (títulos, impérios históricos, caravelas, compassos, personagens, curvas batimétricas) permanecem objetos editoriais ou exigem datasets específicos. As miniaturas dos cartões são geradas pelo motor de mapas, não pelas imagens fornecidas.

| Nº | Arquivo | Scene Look | Leitura visual | Limite |
|---:|---|---|---|---|
| 1 | `022f197ca09440e0d15168ce11913eba.jpg` | **Noir Monochrome** | P&B austero, terra branca/cinza e mar negro; rótulos espaçados. | O estilo não insere nomes automaticamente. |
| 2 | `077115a7c15470a04159b7ad72f969d0.jpg` | **Oceanic Engraving** | Água azul-petróleo gravada e continentes em pergaminho, iconografia naval. | Navios, rosa-dos-ventos e gravuras não são gerados. |
| 3 | `078fde09eb30a31695f1fb97003f45f0.jpg` | **Sultan Parchment** | Mapa histórico sépia, blocos ocre e rosa-pálido e bordas escurecidas. | Fronteiras históricas dependem de Shape editorial. |
| 4 | `16c21bc8a1b88d14a650afd6da7e273d.jpg` | **Imperial Conquest** | Terreno natural com áreas geopolíticas vermelhas e verde imperial. | O tema não colore automaticamente impérios; regiões precisam ser adicionadas. |
| 5 | `2026-11-14_19-53.png` | **Cold War Archive** | Mapa cinza-chumbo documental com grande bloco vermelho e vinheta de filme. | Estados históricos e títulos exigem objetos editoriais. |
| 6 | `2026-11-14_19-54.png` | **Iron Curtain Noir** | Mapa preto e cinza-esverdeado com detalhes vermelhos escuros e tipografia documental. | Nenhuma iconografia histórica é adicionada automaticamente. |
| 7 | `2026-11-15_15-26.png` | **Heritage Documentary** | Regiões europeias em tons pastéis dessaturados sobre relevo cinza-azulado. | Fotografias e monumentos da referência não são adicionados. |
| 8 | `28684c039c7bcbe2c15958598ba669e5.jpg` | **Copper Topography** | Relevo quente com cobre, ferrugem, sombras profundas e oceano azul-acinzentado. | Não gera topografia além da textura instalada. |
| 9 | `2IrTKotqzzYDmDWbQ4H7GOJP6Aii2PdICD8N3LFfJEIJq4ghxSCdzn_CLcpcxDQ7xBPmY7iJC2THrbMJFE35BEIv2L4WX5X1ArtqOvwAGmi25OhnDXEvTQlP_2_Qo222aeTo-yYCfhpI6ok9a9YgITuVK9usCKCGHZ3_vRWZ7EnACE9uj_jp8wpPEeOGzSuV.jpg` | **Contour Radar** | Mapa verde-escuro com traços de curvas de nível e indicadores amarelo-lima. | Curvas de nível altimétricas reais não estão disponíveis; a grade não é equivalente. |
| 10 | `3096f126c54699132851f62a784add63.jpg` | **Sepia Expedition** | Pergaminho envelhecido, entalhes e relevo escuro em castanho. | Papel danificado não está incluído como textura dedicada. |
| 11 | `3e0bbdf4d267decbb686b12464fb8720.jpg` | **Antique Campaign** | Mapa antigo de campanha com áreas vermelho-terra, decoração dourada e sombras. | Insígnias e bandeiras não são geradas pelo preset. |
| 12 | `4ab1fd092d40f42a9ddfd91b1589603d.jpg` | **Explorer Chart** | Carta técnica antiga com areia clara, verde-pálido e marcas costeiras delicadas. | Medidas e topônimos não são colocados automaticamente. |
| 13 | `5d40b5843e4403e7d6d0f58009660347.jpg` | **Turquoise Bathymetry** | Batimetria em turquesa profundo e continentes creme gravados. | Isóbatas detalhadas só estarão disponíveis com dataset próprio. |
| 14 | `7eb8435d697c07b03a1f9220f683e9b7.jpg` | **Compass Antiquity** | Carta antiga com lagoas cinza-esverdeadas e rosa-dos-ventos decorativas. | Compassos e arabescos não são gerados pelo tema. |
| 15 | `8a2c0842ddffa5230107493866e738e4.jpg` | **Desert Caravan** | Mapa de deserto em ouro fosco com tons castanhos, luz dramática. | Personagens, trilhas e sombras humanas são elementos editoriais externos. |
| 16 | `8afc70fd9116ddaeec772ea76060ac22.jpg` | **Maritime Manuscript** | Mapa manuscrito medieval com mar verde-petróleo e moldura vermelha. | Molduras, caravelas e ilustrações não são automáticas. |
| 17 | `CM7mtJPqgADQw7cG9_NHhFhMZAv5VaUJIB_AxAnIpPyWXp-qKi2eTRqz8sywiKD7ydi9gyfkStlf8MCelj4x63IMoZu-pI7FRzZN47waJPtgdR4VjmuRBEcFYTGqbT6hj5ScKk6cf9O-ZNEXDtGERJ0lIHVKLgWk0x6RBUAmLpNEWZa35K_vcOA_Tw8JfQJq.jpg` | **Alpine Survey** | Relevo alpino de alta textura, cristas castanhas e lagos glaciais cianos. | Sombreamento é baseado em raster colorido, não em um DEM calculado. |
| 18 | `Faerunimage.jpg` | **Fantasy Cartographer** | Atlas fantástico pintado, baías azuis e regiões ilustradas de forma orgânica. | Geografia fictícia, nomes e desenhos não substituem Natural Earth. |
| 19 | `asdasdasdasdasdasd.png` | **Obsidian Minimal** | Referência 19 é um retângulo quase inteiramente preto, sem mapa discernível. | Interpretação criativa mínima; não há informação cartográfica extraível. |
| 20 | `c26a3da872ba07cead0fb73215054ab5.jpg` | **Great Lakes Depth** | Mapa de lagos com linhas batimétricas densas em azul-esverdeado. | As linhas batimétricas específicas dos lagos não são inferidas. |
| 21 | `c832f1a35231dc78a985ad168292a047.jpg` | **Vintage Coast Survey** | Carta litorânea envelhecida em creme com áreas marítimas azul-pálido. | Rosa-dos-ventos e cartas portuárias não são desenhadas pelo tema. |
| 22 | `d0ab46f239880c24233b2899442e6be0.jpg` | **Age of Sail** | Mapa-múndi de navegadores em azul profundo, pergaminho dourado e terra envelhecida. | Navios, bordas decoradas e compassos requerem objetos adicionais. |
| 23 | `eb11cb6da9c0428b00c1101d3eda4ab6.jpg` | **Tropical Explorer** | Oceano turquesa vibrante, continentes verdejantes e areia clara. | Ilustrações tropicais adicionais não são automáticas. |
| 24 | `f8e46480e3a11d014616799bd44e09b1.jpg` | **Empire Spotlight** | Relevo escuro com regiões vermelhas de destaque e atmosfera sombria. | Territórios de impérios devem ser desenhados/selecionados manualmente. |
| 25 | `ff90dde5c6e1cda3c9dc984c2f6107f0.jpg` | **Neon Heritage** | Composição híbrida de pergaminho antigo e luzes digitais azul-elétrico. | Efeito de cisão digital/glitch não é suportado por estes parâmetros. |
| 26 | `gGN8YSKAZDA_azDG9wNAGeiilwzHq8a6krxlJJRU0oMXyHAAxMKvgO7UO2mX_W9vCS_DCStKPfAZzyYMznCdDuH152Lmic_39j18UprdF-WUJMCuqRdGzj0aNLU_skm55WKMYortp4VKiPZqMZCFQEhOaKfpFBpp_pW0eFXYhH_VCjw8Md1W4vM1g5nsscwe.jpg` | **Engraved Chronicles** | Mapa europeu com textura gravada em sepia, hachuras e sombreamento antigo. | Gravuras históricas ilustrativas não são geradas automaticamente. |
| 27 | `rpdEbg3QV0_8BDO38XuZWyOiQVUM1K7aUvM9_uEbdsZb4LLKoGisajctaVkzO0Vc7oDPj42JQRWISn4-sCzIY6-p_BFqGVFdBKSNFqSfRslMCp_MTTQ6J-F7DgUnrsAsyMe1EtIghNsmvOOxW_HyQ6ujH1llkhbPnFM_SKBBgTLQHddrqbDmpWcZo9ESocma.jpg` | **Crimson Geopolitics** | Mapa minimalista azul-noite com áreas de destaque vermelho intenso. | Países vermelhos de referência precisam ser selecionados como Region. |
