import psycopg2
candidates = [
    {'host':'localhost','port':'5432','database':'postgres','user':'postgres'},
    {'host':'localhost','port':'5432','database':'postgres','user':'postgres','password':'postgres'},
    {'host':'localhost','port':'5432','database':'postgres','user':'postgres','password':'admin'},
    {'host':'localhost','port':'5432','database':'postgres','user':'postgres','password':'password'},
    {'host':'localhost','port':'5432','database':'postgres','user':'assetiq_user','password':'assetiq'},
]
for kwargs in candidates:
    try:
        conn = psycopg2.connect(**kwargs)
        print('SUCCESS', kwargs)
        conn.close()
        break
    except Exception as e:
        print('FAIL', kwargs, '=>', e)
