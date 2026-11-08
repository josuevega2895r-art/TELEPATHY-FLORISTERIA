UPDATE ramos
SET imagen = CASE codigo
  WHEN 'RAM-001' THEN 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=640&q=75'
  WHEN 'COM-001' THEN 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=640&q=75'
END
WHERE codigo IN ('RAM-001', 'COM-001');
