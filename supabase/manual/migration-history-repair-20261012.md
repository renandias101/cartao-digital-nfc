# Reparo do histórico de migrations — 12/10/2026

O schema remoto já continha as migrations abaixo, registradas em 05/10 com
timestamps diferentes dos arquivos locais. O reparo remove os registros antigos
do histórico e marca as versões locais equivalentes como aplicadas. Nenhuma
alteração de schema ou dado de negócio é executada pelo `migration repair`.

| Registro remoto anterior | Arquivo local equivalente |
|---|---|
| 20261005012201 card_profession | 20261003150000_card_profession.sql |
| 20261005012219 card_accent_color | 20261003190000_card_accent_color.sql |
| 20261005012220 card_contact_phone | 20261004120000_card_contact_phone.sql |
| 20261005012221 card_footer | 20261004130000_card_footer.sql |
| 20261005014705 support_requests | 20261004140000_support_requests.sql |
| 20261005022017 edicao_administrativa_do_cartao | 20261004170000_edicao_administrativa_do_cartao.sql |
| 20261005023022 exclusao_apos_3_meses | 20261004150000_exclusao_apos_3_meses.sql |
| 20261005023030 dados_administrativos_do_cliente | 20261004160000_dados_administrativos_do_cliente.sql |
| 20261005023046 registro_de_pagamentos | 20261004180000_registro_de_pagamentos.sql |
| 20261005023049 suporte_classificacao | 20261004190000_suporte_classificacao.sql |
| 20261005023109 visao_operacional_admin | 20261004200000_visao_operacional_admin.sql |

As migrations anteriores a 03/10 e as cinco migrations de 10/10 também já
existiam no schema, embora tivessem sido aplicadas manualmente sem registro com
seus timestamps locais.
