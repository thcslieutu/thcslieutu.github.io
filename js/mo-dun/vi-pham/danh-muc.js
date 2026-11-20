'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – DANH MỤC (hình thức vi phạm, biện pháp xử lý)
   ===================================================================== */
function veDanhMucVP(el) {
  const conSong = giuPhien();
  const coCotCC = true;
  const suaBP = App.coQuyen('vp.bien_phap'), suaHT = App.coQuyen('vp.hinh_thuc');
  el.innerHTML = `<section class="card">
    <h2>Hình thức vi phạm</h2>
    <p class="muted small"><b>Áp dụng cho</b>: “Học sinh” – ghi cho từng em; “Cả lớp” – vi phạm tập thể, ghi cho lớp.
    <b>Mức độ</b>: xanh – Nhẹ, cam – Trung bình, đỏ – <b>Nặng (chỉ người có quyền “Xử lý mọi vi phạm” xử lý)</b>. Điểm trừ dùng cho thống kê; <b>đổi điểm trừ chỉ áp dụng cho vi phạm ghi nhận sau khi đổi</b>, vi phạm đã ghi giữ nguyên điểm cũ.
    Hình thức đã phát sinh vi phạm nên <b>tắt “Đang dùng”</b> thay vì xóa.
    ${suaHT ? '' : '<br><span class="canh-bao">Bạn chỉ được xem. Cần quyền “Sửa hình thức vi phạm” để thêm, sửa.</span>'}
    <b>Chuyên cần</b>: chọn cho các hình thức nghỉ có phép / nghỉ không phép / cúp tiết để tính vào báo cáo chuyên cần (phân hệ Chuyên cần). Vi phạm “Nghỉ có phép” tự chuyển sang Đã xử lý.</p>
    <div class="table-wrap"><table class="tbl edit"><thead><tr><th>Thứ tự</th><th>Tên hình thức vi phạm</th><th>Áp dụng cho</th><th>Nhóm</th><th>Mức độ</th><th>Điểm trừ</th>${coCotCC ? '<th>Chuyên cần</th>' : ''}<th>Đang dùng</th><th></th></tr></thead>
    <tbody id="loai-body"></tbody></table></div>
    <datalist id="dl-nhom"></datalist></section>
  <section class="card">
    <h2>Biện pháp xử lý</h2>
    <p class="muted small">Danh sách nút chọn nhanh khi xử lý vi phạm. Có thể thêm, sửa tên, xếp nhóm, sắp thứ tự hoặc tắt.
    Sửa hay xóa ở đây <b>không ảnh hưởng</b> các vi phạm đã xử lý trước đó. Người xử lý vẫn có thể gõ thêm nội dung riêng.</p>
    ${App.coQuyen('vp.bien_phap') ? '' : '<p class="small canh-bao">Bạn chỉ được xem danh mục này. Cần quyền “Sửa biện pháp xử lý” để thêm, sửa.</p>'}
    <div class="table-wrap"><table class="tbl edit"><thead><tr><th>Thứ tự</th><th>Tên biện pháp</th><th>Nhóm</th><th>Đang dùng</th><th></th></tr></thead>
    <tbody id="bp-body"></tbody></table></div>
    <datalist id="dl-nhom-bp"></datalist></section>`;
  const dongBP = b => !suaBP
    ? `<tr><td>${b.thu_tu ?? ''}</td><td>${esc(b.ten)}</td><td>${esc(b.nhom || '')}</td><td class="c">${b.dang_dung !== false ? '✓' : '<span class="muted">Tắt</span>'}</td><td></td></tr>`
    : `<tr data-id="${b.id > 0 ? b.id : ''}" class="${b.id > 0 ? '' : 'new-row'}">
    <td><input class="input sm num" name="thu_tu" type="number" value="${b.thu_tu ?? ''}"></td>
    <td><input class="input sm" name="ten" value="${esc(b.ten || '')}" placeholder="${b.id > 0 ? '' : '+ Thêm biện pháp mới…'}"></td>
    <td><input class="input sm" name="nhom" list="dl-nhom-bp" value="${esc(b.nhom || '')}"></td>
    <td class="c"><input type="checkbox" name="dang_dung" ${b.dang_dung !== false ? 'checked' : ''}></td>
    <td class="nowrap"><button type="button" class="btn sm ${b.id > 0 ? '' : 'primary'}" data-luu>${b.id > 0 ? 'Lưu' : 'Thêm'}</button>${b.id > 0 ? '<button type="button" class="link danger" data-xoa>Xóa</button>' : ''}</td></tr>`;
  const veBP = () => {
    const ds = S.bp;
    const maxTT = Math.max(0, ...ds.map(b => b.thu_tu || 0));
    $('#bp-body').innerHTML = ds.map(dongBP).join('') + (suaBP ? dongBP({ thu_tu: maxTT + 1 }) : '');
    $('#dl-nhom-bp').innerHTML = ['Biện pháp kỷ luật', 'Hỗ trợ khắc phục', 'Phối hợp gia đình', ...ds.map(b => b.nhom)]
      .filter((n, i, a) => n && a.indexOf(n) === i).map(n => `<option value="${esc(n)}">`).join('');
  };
  const dongXem = l => `<tr><td>${l.thu_tu ?? ''}</td><td><span class="dot md${l.muc_do}"></span>${esc(l.ten)}</td><td>${PHAM_VI[l.pham_vi] || ''}</td><td>${esc(l.nhom || '')}</td>
    <td>${MUC_DO[l.muc_do] || ''}</td><td class="r">${so(l.diem_tru)}</td><td>${CC[l.chuyen_can] || ''}</td><td class="c">${l.dang_dung ? '✓' : '<span class="muted">Tắt</span>'}</td><td></td></tr>`;
  const dong = l => !suaHT ? dongXem(l) : `<tr data-id="${l.id || ''}" class="${l.id ? '' : 'new-row'}">
    <td><input class="input sm num" name="thu_tu" type="number" value="${l.thu_tu ?? ''}"></td>
    <td><input class="input sm" name="ten" value="${esc(l.ten || '')}" placeholder="${l.id ? '' : '+ Thêm hình thức mới…'}"></td>
    <td><select class="input sm" name="pham_vi">${Object.entries(PHAM_VI).map(([k, t]) => `<option value="${k}" ${(l.pham_vi || 'hoc_sinh') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input class="input sm" name="nhom" list="dl-nhom" value="${esc(l.nhom || '')}"></td>
    <td><select class="input sm md-sel" name="muc_do">${[1, 2, 3].map(k => `<option value="${k}" ${(l.muc_do || 1) === k ? 'selected' : ''}>${MUC_DO[k]}</option>`).join('')}</select></td>
    <td><input class="input sm num" name="diem_tru" type="number" step="0.5" min="0" value="${l.diem_tru ?? 0}"></td>
    ${coCotCC ? `<td><select class="input sm" name="chuyen_can"><option value="">—</option>${Object.entries(CC).map(([k, t]) => `<option value="${k}" ${l.chuyen_can === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>` : ''}
    <td class="c"><input type="checkbox" name="dang_dung" ${l.dang_dung !== false ? 'checked' : ''}></td>
    <td class="nowrap"><button type="button" class="btn sm ${l.id ? '' : 'primary'}" data-luu>${l.id ? 'Lưu' : 'Thêm'}</button>${l.id ? '<button type="button" class="link danger" data-xoa>Xóa</button>' : ''}</td></tr>`;
  const ve = () => {
    const maxTT = Math.max(0, ...S.loai.map(l => l.thu_tu || 0));
    const ds = [...S.loai].sort((a, b) => (a.pham_vi === 'lop') - (b.pham_vi === 'lop') || (a.thu_tu || 0) - (b.thu_tu || 0));
    $('#loai-body').innerHTML = ds.map(dong).join('') + (suaHT ? dong({ thu_tu: maxTT + 1 }) : '');
    $('#dl-nhom').innerHTML = [...new Set(S.loai.map(l => l.nhom).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('');
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-luu],[data-xoa]'); if (!b) return;
    const tr = b.closest('tr'), id = +tr.dataset.id || null;
    const v = n => tr.querySelector(`[name=${n}]`);
    let res;
    if (tr.closest('#bp-body')) {             // ----- Biện pháp xử lý
      if (!suaBP) return;
      if (b.dataset.xoa !== undefined) {
        if (!confirm(`Xóa biện pháp “${v('ten').value}” khỏi danh mục?`)) return;
        res = await sb.from('bien_phap').delete().eq('id', id);
      } else {
        const row = { ten: v('ten').value.trim(), nhom: v('nhom').value.trim() || null, dang_dung: v('dang_dung').checked, thu_tu: +v('thu_tu').value || 0 };
        if (!row.ten) { toast('Nhập tên biện pháp.', 'err'); v('ten').focus(); return; }
        res = id ? await sb.from('bien_phap').update(row).eq('id', id) : await sb.from('bien_phap').insert(row);
      }
      if (res.error) { toast(dichLoi(res.error), 'err'); return; }
      toast('Đã lưu.'); await taiDanhMuc(); if (conSong()) veBP();
      return;
    }
    if (!suaHT) return;
    if (b.dataset.xoa !== undefined) {
      if (!confirm('Xóa hình thức vi phạm này?')) return;
      res = await sb.from('loai_vi_pham').delete().eq('id', id);
    } else {
      const row = { ten: v('ten').value.trim(), pham_vi: v('pham_vi').value, nhom: v('nhom').value.trim() || null, muc_do: +v('muc_do').value, diem_tru: +v('diem_tru').value || 0, dang_dung: v('dang_dung').checked, thu_tu: +v('thu_tu').value || 0 };
      if (v('chuyen_can')) row.chuyen_can = v('chuyen_can').value || null;
      if (!row.ten) { toast('Nhập tên hình thức vi phạm.', 'err'); v('ten').focus(); return; }
      res = id ? await sb.from('loai_vi_pham').update(row).eq('id', id) : await sb.from('loai_vi_pham').insert(row);
    }
    if (res.error) { toast(/foreign key/i.test(res.error.message) ? 'Hình thức này đã có vi phạm, không thể xóa. Hãy bỏ chọn “Đang dùng”.' : dichLoi(res.error), 'err'); return; }
    toast('Đã lưu.'); await taiDanhMuc(); if (conSong()) ve();
  };
  el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('#loai-body input, #bp-body input')) { e.preventDefault(); e.target.closest('tr').querySelector('[data-luu]').click(); } };
  ve(); veBP();
}
