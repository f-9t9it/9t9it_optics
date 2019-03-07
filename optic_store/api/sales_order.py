# -*- coding: utf-8 -*-
# Copyright (c) 2019, 9T9IT and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
from erpnext.stock.get_item_details import get_pos_profile


@frappe.whitelist()
def invoice_qol(name, mode_of_payment=None, amount=None):
    doc = make_sales_invoice(name)
    if mode_of_payment and amount:
        doc.is_pos = 1
        doc.append("payments", {"mode_of_payment": mode_of_payment, "amount": amount})
    doc.insert(ignore_permissions=True)
    doc.submit()
    pos_profile = get_pos_profile(doc.company)
    return {
        "sales_invoice_name": doc.name,
        "print_format": _get_print_format_from(pos_profile),
        "no_letterhead": "1" if pos_profile and pos_profile.letter_head else "0",
    }


def _get_print_format_from(pos_profile):
    if not pos_profile:
        return "Standard"
    return pos_profile.print_format_for_online or pos_profile.print_format or "Standard"