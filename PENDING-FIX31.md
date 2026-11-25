# Cho doi FIX31 (truoc khi push dot 1)

- server/sql/ DANG TRONG trong staging (da xoa 4 file cu: shops-apply-FINAL.sql,
  shopmax-apply.sql, fix28-npc-rows.sql, verify-shops-applied.sql).
- Sau khi FIX31 land: lay lai export moi tu DB live (shop + vi tri NPC goc),
  dat vao staging server/sql/, kiem tra lai ten file + noi dung, roi moi push dot 1.
- FIX31: (1) NPC shop ve vi tri goc (bo 2 hang FIX28), (2) EXP x10, (3) nhan vat
  moi 2 ty Zen. README da ghi theo gia tri MOI.
- Web + bridge + accounts + deploy scripts khong bi anh huong, san sang push.
