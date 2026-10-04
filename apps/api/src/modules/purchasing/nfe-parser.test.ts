import { describe, expect, it } from 'vitest';

import { NfeParseError, parseNfe } from './nfe-parser';

const KEY = '35261012345678000190550010000001231000000019';

const nfe = (items: string, extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe${KEY}" versao="4.00">
    <ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-10-01T10:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>12.345.678/0001-90</CNPJ><xNome>Distribuidora Geek Ltda</xNome></emit>
    ${items}
    <total><ICMSTot><vNF>${extra || '255.50'}</vNF></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>`;

const det = (n: number, prod: string) => `<det nItem="${n}"><prod>${prod}</prod></det>`;
const prod = (over: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    cProd: 'FUN-001',
    cEAN: '7898572679235',
    xProd: 'BONECO FUNKO POP HULK',
    NCM: '95030099',
    qCom: '10.0000',
    vUnCom: '12.5000000000',
    vProd: '125.00',
    ...over,
  };
  return Object.entries(fields)
    .map(([tag, value]) => `<${tag}>${value}</${tag}>`)
    .join('');
};

describe('parseNfe', () => {
  it('reads the header, the supplier and the items', () => {
    const parsed = parseNfe(
      nfe(
        det(1, prod()) +
          det(
            2,
            prod({
              cProd: 'CAN-9',
              cEAN: 'SEM GTIN',
              xProd: 'CANECA',
              qCom: '2.0000',
              vProd: '130.50',
            })
          )
      )
    );
    expect(parsed.accessKey).toBe(KEY);
    expect(parsed.number).toBe('123');
    expect(parsed.series).toBe('1');
    expect(parsed.issuedAt?.toISOString()).toBe('2026-10-01T13:00:00.000Z');
    expect(parsed.supplier).toEqual({
      document: '12345678000190',
      name: 'Distribuidora Geek Ltda',
    });
    expect(parsed.totalCents).toBe(25550);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({
      line: 1,
      supplierCode: 'FUN-001',
      ean: '7898572679235',
      ncm: '95030099',
      quantity: 10,
      unitCostCents: 1250,
      totalCostCents: 12500,
    });
    expect(parsed.items[1]).toMatchObject({ ean: null, quantity: 2, unitCostCents: 6525 });
  });

  it('accepts a note with a single item (the XML has no array then)', () => {
    expect(parseNfe(nfe(det(1, prod()))).items).toHaveLength(1);
  });

  it('works without the nfeProc envelope', () => {
    const bare = nfe(det(1, prod()))
      .replace(/<nfeProc[^>]*>/, '')
      .replace('</nfeProc>', '');
    expect(parseNfe(bare).accessKey).toBe(KEY);
  });

  it('drops an EAN with a wrong check digit instead of trusting it', () => {
    expect(parseNfe(nfe(det(1, prod({ cEAN: '7898572679236' })))).items[0]?.ean).toBeNull();
  });

  it('refuses fractional quantities, a bad key and a file that is not an NF-e', () => {
    expect(() => parseNfe(nfe(det(1, prod({ qCom: '1.5000' }))))).toThrow(/quantidades inteiras/);
    expect(() => parseNfe(nfe(det(1, prod())).replace(KEY, '123'))).toThrow(/chave de acesso/);
    expect(() => parseNfe('<html><body>oi</body></html>')).toThrow(NfeParseError);
    expect(() => parseNfe('isto não é xml')).toThrow(NfeParseError);
  });
});
