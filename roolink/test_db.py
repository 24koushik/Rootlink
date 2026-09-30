import sqlite3

try:
    conn = sqlite3.connect('database.sqlite')
    c = conn.cursor()
    c.execute('SELECT id, canonical_name FROM nodes WHERE canonical_name LIKE "%What is Java%"')
    rows = c.fetchall()
    for row in rows:
        print(row)
except Exception as e:
    print(e)
