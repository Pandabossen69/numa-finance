import { describe, expect, it } from "vitest";
import { looksLikeBangkokBankMail, parseBankMailPayment } from "./bank-mail-parser";

// Synthetic fixtures in the bilingual Bangkok Bank "Payment confirmation"
// layout (Thai block, then English). Only the English block is parsed.
// Account digits, reference numbers, receipt numbers, amounts, and
// timestamps are fictional. Merchant names and the TMNINAPP wallet code
// stay, because they are what the parser is supposed to recognize.

const TRUEMONEY_TOPUP_MAIL = `
บริการอัตโนมัติ: ยืนยันการจ่ายเงิน ผ่านโมบายแบงก์กิ้งธนาคารกรุงเทพ

ไปที่:
 	รหัสบริษัท / รหัสผู้ให้บริการ	 TMNINAPP
 	ชื่อบริษัท / ชื่อผู้ให้บริการ	 TRUE MONEY CO., LTD.
จาก:
 	เลขที่บัญชี / หมายเลขบัตรเครดิต	 111-2-xxx345
 	เลขที่อ้างอิง 1	 0811112233
 	เลขที่อ้างอิง 2	 26010109000000000001
 	จำนวนเงิน (บาท)	 350.00
 	ค่าธรรมเนียม (บาท)	 0.00
 	บันทึก
 	หมายเลขอ้างอิง	 100001
 	วันที่	 15 มีนาคม 2569 เวลา 09:15:42 น.

Automatic e-mail: Payment confirmation

To:
 	Service code / Payee ID	  TMNINAPP
 	Service name / Payee name	  TRUE MONEY CO., LTD.
From:
 	Account no. / credit card no.	  111-2-xxx345
 	Reference no. 1	  0811112233
 	Reference no. 2	  26010109000000000001
 	Amount (Baht)	  350.00
 	Fee (Baht)	  0.00
 	Note
 	Reference no.	  100001
 	Date	  15 March 2026 at 09:15:42 (Thailand time)

This is an automatically generated message to confirm that a payment has been made from your account.
`;

const MCDONALDS_MAIL = `
บริการอัตโนมัติ: ยืนยันการจ่ายเงิน ผ่านโมบายแบงก์กิ้งธนาคารกรุงเทพ

ไปที่:
 	รหัสบริษัท / รหัสผู้ให้บริการ	 010753600031501
 	ชื่อบริษัท / ชื่อผู้ให้บริการ	 MCD-00179HUA-HIN MARKET V
จาก:
 	เลขที่บัญชี / หมายเลขบัตรเครดิต	 111-2-xxx345
 	เลขที่อ้างอิง 1	 400000111222001
 	เลขที่อ้างอิง 2	 EDC17900000000000001
 	จำนวนเงิน (บาท)	 312.50
 	ค่าธรรมเนียม (บาท)	 0.00
 	บันทึก
 	หมายเลขอ้างอิง	 200002
 	วันที่	 3 มกราคม 2569 เวลา 11:08:05 น.

Automatic e-mail: Payment confirmation

To:
 	Service code / Payee ID	  010753600031501
 	Service name / Payee name	  MCD-00179HUA-HIN MARKET V
From:
 	Account no. / credit card no.	  111-2-xxx345
 	Reference no. 1	  400000111222001
 	Reference no. 2	  EDC17900000000000001
 	Amount (Baht)	  312.50
 	Fee (Baht)	  0.00
 	Note
 	Reference no.	  200002
 	Date	  3 January 2026 at 11:08:05 (Thailand time)

This is an automatically generated message to confirm that a payment has been made from your account.
`;

describe("looksLikeBangkokBankMail", () => {
  it("recognizes the payment confirmation format", () => {
    expect(looksLikeBangkokBankMail(TRUEMONEY_TOPUP_MAIL)).toBe(true);
    expect(looksLikeBangkokBankMail(MCDONALDS_MAIL)).toBe(true);
  });

  it("rejects unrelated text", () => {
    expect(looksLikeBangkokBankMail("Hej, kan vi ses imorgon?")).toBe(false);
  });

  it("rejects a bare confirmation phrase that is not this mail", () => {
    expect(looksLikeBangkokBankMail("Your payment confirmation is attached.")).toBe(
      false,
    );
    expect(looksLikeBangkokBankMail("Payee name: someone")).toBe(false);
  });
});

describe("parseBankMailPayment — TrueMoney top-up", () => {
  const parsed = parseBankMailPayment(TRUEMONEY_TOPUP_MAIL);

  it("extracts the payee and amount", () => {
    expect(parsed?.merchant).toBe("TRUE MONEY CO., LTD.");
    expect(parsed?.payeeCode).toBe("TMNINAPP");
    expect(parsed?.amountMinor).toBe(35000);
    expect(parsed?.currency).toBe("THB");
  });

  it("extracts the masked account and reference numbers", () => {
    expect(parsed?.maskedAccount).toBe("2345");
    expect(parsed?.referenceNo1).toBe("0811112233");
    expect(parsed?.referenceNo2).toBe("26010109000000000001");
    expect(parsed?.referenceNo).toBe("100001");
  });

  it("keeps an explicit Bangkok offset (matches the rest of the codebase's convention)", () => {
    expect(parsed?.occurredAt).toBe("2026-03-15T09:15:42+07:00");
  });

  it("flags it as an e-wallet top-up, not a real merchant", () => {
    expect(parsed?.isWalletTopUp).toBe(true);
  });
});

describe("parseBankMailPayment — real merchant (McDonald's)", () => {
  const parsed = parseBankMailPayment(MCDONALDS_MAIL);

  it("extracts the merchant name and amount", () => {
    expect(parsed?.merchant).toBe("MCD-00179HUA-HIN MARKET V");
    expect(parsed?.amountMinor).toBe(31250);
  });

  it("extracts reference numbers distinct from the top-up example", () => {
    expect(parsed?.referenceNo).toBe("200002");
    expect(parsed?.referenceNo1).toBe("400000111222001");
    expect(parsed?.referenceNo2).toBe("EDC17900000000000001");
  });

  it("does NOT flag a real merchant as a wallet top-up", () => {
    expect(parsed?.isWalletTopUp).toBe(false);
  });

  it("converts its own distinct timestamp correctly", () => {
    expect(parsed?.occurredAt).toBe("2026-01-03T11:08:05+07:00");
  });
});

describe("parseBankMailPayment — non-matching input", () => {
  it("returns null instead of guessing", () => {
    expect(parseBankMailPayment("Just a random email about dinner plans.")).toBeNull();
    expect(
      parseBankMailPayment("Your payment confirmation is attached."),
    ).toBeNull();
  });

  it("keeps a zero amount and ignores an unreadable amount", () => {
    const zero = parseBankMailPayment(`
Automatic e-mail: Payment confirmation
Service name / Payee name  CORNER SHOP
Amount (Baht)  0.00
Date  1 January 2026 at 08:00:00 (Thailand time)
`);
    expect(zero?.amountMinor).toBe(0);
    expect(zero?.merchant).toBe("CORNER SHOP");

    const broken = parseBankMailPayment(`
Automatic e-mail: Payment confirmation
Service name / Payee name  CORNER SHOP
Amount (Baht)  not-a-number
`);
    expect(broken).not.toBeNull();
    expect(broken?.amountMinor).toBeNull();
    expect(broken?.merchant).toBe("CORNER SHOP");
  });
});
