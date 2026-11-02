from yourbroker.data_prep import fund_asset_class, normalise_header, parse_index_csv, parse_navall, to_num

CSV = ('﻿"SYMBOL \n","OPEN \n","HIGH \n","LOW \n","PREV. CLOSE \n","LTP \n","CHNG \n","%CHNG \n",'
       '"VOLUME \n(shares)","VALUE \n(₹ Crores)","52W H \n","52W L \n","30 D %CHNG \n","365 D % CHNG \n 30-Oct-2025"\n'
       '"NIFTY 50","24,457.79","24,598.00","24,335.62","24,433.36","24,500.00","66.64","0.27","44,793,029","2,718.66","27,440.00","21,070.00","-0.26","5.44"\n'
       '"ABC","1,164.90","1,170.00","1,150.00","1,160.00","1,164.90","4.90","0.42","1,000","11.65","1,300.00","900.00","-","12.50"\n')

NAV6 = """Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Flexi Cap Fund)

Some Mutual Fund

100001;INF1;-;X Flexi Cap Fund - Direct Plan - Growth;55.1234;30-Oct-2026
100002;INF2;INF3;X Flexi Cap Fund - Direct Plan - IDCW;40.0;30-Oct-2026
100003;INF4;-;X Flexi Cap Fund - Regular Plan - Growth;50.0;30-Oct-2026
100004;INF5;-;Old Fund - Direct Plan - Growth;10.0;14-Mar-2018

Open Ended Schemes(Debt Scheme - Liquid Fund)

Other Mutual Fund

200001;INF6;-;Y Liquid Fund - Direct Plan - Growth;3000.5;30-Oct-2026
"""
NAV8 = """Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date

Open Ended Schemes(Other Scheme - Index Funds)

Z Mutual Fund

300001;INF7;-;Z Nifty 50 Index Fund;Direct Plan;Growth;20.5;30-Oct-2026
300002;INF8;-;Z Nifty 50 Index Fund;Regular Plan;Growth;20.0;30-Oct-2026
"""


def test_headers_and_numbers():
    assert normalise_header("365 D % CHNG \n 30-Oct-2025") == "chg_365d"
    assert normalise_header("﻿SYMBOL \n") == "symbol"
    assert normalise_header("PREV. CLOSE \n") == "prev_close"
    assert to_num("1,164.90") == 1164.9
    assert to_num("-") != to_num("-")  # NaN


def test_index_csv_first_row_is_index(tmp_path):
    fp = tmp_path / "MW-NIFTY-50-30-Oct-2026.csv"
    fp.write_bytes(CSV.encode("utf-8"))
    idx, cons = parse_index_csv(fp)
    assert idx["symbol"] == "NIFTY 50" and idx["chg_365d"] == 5.44
    assert list(cons["symbol"]) == ["ABC"]
    assert cons.loc[0, "ltp"] == 1164.9
    assert cons["chg_30d"].isna().all()


def test_navall_six_columns(tmp_path):
    fp = tmp_path / "NAVAll.txt"
    fp.write_text(NAV6, encoding="utf-8")
    df, rep = parse_navall(fp, "30-Oct-2026")
    assert sorted(df["scheme_code"]) == ["100001", "200001"]
    assert rep["dropped_stale_date"] == 1 and rep["dropped_not_direct_growth"] == 2
    assert set(df["amc"]) == {"Some Mutual Fund", "Other Mutual Fund"}
    assert df.set_index("scheme_code").loc["200001", "catalogue"] == "liquid_fund"


def test_navall_eight_columns(tmp_path):
    fp = tmp_path / "NAVAll.txt"
    fp.write_text(NAV8, encoding="utf-8")
    df, rep = parse_navall(fp, "30-Oct-2026")
    assert list(df["scheme_code"]) == ["300001"] and rep["layout_columns"] == 8


def test_fund_asset_class():
    assert fund_asset_class("Open Ended Schemes(Debt Scheme - Gilt Fund)") == ("debt_fund", "debt")
    assert fund_asset_class("Open Ended Schemes(Equity Scheme - Small Cap Fund)")[1] == "equity_small"
