import sumBy from 'lodash/sumBy';

function set_queries(frm) {
  const { company } = frm.doc;
  ['source_warehouse', 'target_warehouse'].forEach(field => {
    frm.set_query(field, { company, is_group: 0 });
  });
}

function calc_and_set_row_amount(frm, cdt, cdn) {
  const { qty = 0, basic_rate = 0 } = frappe.model.get_doc(cdt, cdn);
  const amount = qty * basic_rate;
  frappe.model.set_value(cdt, cdn, 'amount', qty * basic_rate);
  frappe.model.set_value(cdt, cdn, 'valuation_rate', amount / qty);
}

function calc_and_set_total_amount(frm, cdt, cdn) {
  const items = frm.fields_dict.items.grid.grid_rows.map(({ doc }) => doc);
  frm.set_value('total_value', sumBy(items, 'amount'));
  frm.set_value('total_qty', sumBy(items, 'qty'));
}

export const stock_transfer_item = {
  item_code: async function(frm, cdt, cdn) {
    const { item_code } = frappe.model.get_doc(cdt, cdn);
    const { source_warehouse: warehouse, company } = frm.doc;
    frappe.model.set_value(cdt, cdn, 'qty', item_code ? 1 : 0);
    frappe.model.set_value(cdt, cdn, 'conversion_factor', 1);
    if (item_code) {
      const { has_batch_no, has_serial_no } = await frappe.db.get_doc(
        'Item',
        item_code
      );
      erpnext.show_serial_batch_selector(
        frm,
        { item_code, has_batch_no, has_serial_no, warehouse },
        ({ batch_no, serial_no, qty }) => {
          frappe.model.set_value(cdt, cdn, 'qty', qty);
          if (has_batch_no) {
            frappe.model.set_value(cdt, cdn, 'batch_no', batch_no);
          }
          if (has_serial_no) {
            frappe.model.set_value(cdt, cdn, 'serial_no', serial_no);
          }
        }
      );
      const [posting_date, posting_time] = frm.doc.outgoing_datetime.split(' ');
      const { serial_no, qty } = frappe.model.get_doc(cdt, cdn);
      const { message: basic_rate = 0 } = await frappe.call({
        method: 'erpnext.stock.utils.get_incoming_rate',
        args: {
          args: {
            item_code,
            posting_date,
            posting_time,
            warehouse,
            serial_no,
            company,
            qty,
          },
        },
      });
      frappe.model.set_value(cdt, cdn, 'basic_rate', basic_rate);
    }
  },
  qty: calc_and_set_row_amount,
  basic_rate: calc_and_set_row_amount,
  amount: calc_and_set_total_amount,
  items_remove: calc_and_set_row_amount,
};

export default {
  refresh: function(frm) {
    set_queries(frm);
    if (frm.doc.__islocal) {
      frm.set_value('outgoing_datetime', frappe.datetime.now_datetime());
    }
    frm.toggle_enable('incoming_datetime', frm.doc.workflow_state === 'In Transit');
    if (frm.doc.workflow_state === 'In Transit') {
      frm.set_value('incoming_datetime', frappe.datetime.now_datetime());
    }
  },
  company: set_queries,
};