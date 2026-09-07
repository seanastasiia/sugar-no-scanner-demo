"""Reader for OFF's daily export_database.pl TSV (literal quote characters)."""
import csv

REQUIRED_FIELDS = {"code", "countries_tags", "ingredients_text", "proteins_100g", "sugars_100g", "quantity"}


def daily_export_reader(text):
    reader = csv.DictReader(text, delimiter="\t", quoting=csv.QUOTE_NONE)
    if not REQUIRED_FIELDS.issubset(reader.fieldnames or []):
        raise ValueError("Unexpected source schema")
    return reader


def complete_row(row):
    return None not in row and all(value is not None for value in row.values())
