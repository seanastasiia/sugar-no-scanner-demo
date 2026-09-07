import io
import unittest
from off_tsv import complete_row, daily_export_reader


class DailyOffExportTest(unittest.TestCase):
    header = "code\tcountries_tags\tingredients_text\tproteins_100g\tsugars_100g\tquantity\tproduct_name\n"

    def test_literal_quotes_do_not_consume_later_products(self):
        data = self.header + '1\ten:latvia\t"Potatoes, salt\t5\t0.6\t100 g\t"Chips\n2\ten:lithuania\tMilk\t11\t4\t400 g\tSkyr\n'
        rows = list(daily_export_reader(io.StringIO(data)))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["product_name"], '"Chips')
        self.assertEqual(rows[0]["sugars_100g"], "0.6")
        self.assertEqual(rows[1]["proteins_100g"], "11")
        self.assertTrue(all(complete_row(row) for row in rows))

    def test_extra_or_missing_columns_are_rejected_not_shifted(self):
        rows = list(daily_export_reader(io.StringIO(self.header + '1\ten:latvia\tMilk\t4\t2\t100 g\tName\textra\n2\ten:latvia\tMilk\n')))
        self.assertTrue(all(not complete_row(row) for row in rows))

    def test_unknown_schema_fails_closed(self):
        with self.assertRaises(ValueError):
            daily_export_reader(io.StringIO("code\tname\n1\tExample\n"))


if __name__ == "__main__":
    unittest.main()
