const { cleanAndFormatSql } = require('./packages/sdk/dist/utils/sql-formatter.js');
const sql = `sb.append("      HACHU_NO ");                               // 発注番号
		sb.append("     , TENPO_CD ");                              // 店舗コード
		sb.append("     , SYOHIN_CD ");                             // 商品コード`;
console.log(cleanAndFormatSql(sql));
