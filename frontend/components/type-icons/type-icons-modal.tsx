'use client';

import { useState } from 'react';
import { IconPlus, IconTrash, IconChevronRight } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IconPicker } from '@/components/ui/icon-picker';
import { usePixelTheme } from '@/components/pixel';
import { useTypeIcons, type TypeIcon } from '@/store/type-icons-store';
import { readableOn } from '@/lib/palette';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';

type IconComp = React.ComponentType<{ size?: number; className?: string; color?: string; style?: React.CSSProperties }>;
const Icons = TablerIcons as unknown as Record<string, IconComp>;

function RenderIcon({ name, size = 20, className, color }: { name: string; size?: number; className?: string; color?: string }) {
  if (!name) return <span style={{ color: '#888', fontSize: 12 }}>?</span>;
  const Comp = Icons[name];
  if (!Comp) return <span style={{ color: '#888', fontSize: 12 }}>?</span>;
  return <Comp size={size} className={className} color={color} />;
}

interface TypeIconsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TypeIconsModal({ open, onOpenChange }: TypeIconsModalProps) {
  const theme = usePixelTheme();
  const { icons, addIcon, updateIcon, removeIcon } = useTypeIcons();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIcon, setEditingIcon] = useState<TypeIcon | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  const openEditor = (ti?: TypeIcon) => {
    if (ti) {
      setEditingIcon(ti);
      setName(ti.name);
      setIcon(ti.icon);
      setColor(ti.color || '');
    } else {
      setEditingIcon(null);
      setName('');
      setIcon('');
      setColor('');
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !icon) return;
    if (editingIcon) {
      await updateIcon(editingIcon.id, { name: name.trim(), icon, color: color || undefined });
    } else {
      await addIcon({ name: name.trim(), icon, color: color || undefined });
    }
    setEditorOpen(false);
  };

  const dialogStyle: React.CSSProperties = {
    maxWidth: 440,
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    borderRadius: 0,
    color: theme.ink,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 0,
    gap: 0,
    display: 'block',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} style={dialogStyle}>
          <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
            <h2
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: 0,
              }}
            >
              Tile Type Icons
            </h2>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
              Gestisci le icone di tipo dei tile.
            </p>
          </div>

          <div style={{ padding: 14, maxHeight: '60vh', overflowY: 'auto' }}>
            <span
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink3,
                display: 'block',
                marginBottom: 8,
              }}
            >
              Custom Icons
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => openEditor()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: `2px dashed ${theme.border}`,
                  color: theme.ink3,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: theme.surface,
                    border: `2px solid ${theme.border}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconPlus size={14} />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Add type icon
                </span>
              </button>

              {icons.map((ti) => (
                <div
                  key={ti.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: theme.surfaceVariant,
                    border: `2px solid ${theme.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: ti.color || theme.surface,
                      border: `2px solid ${theme.border}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RenderIcon name={ti.icon} size={20} color={readableOn(ti.color || theme.surface)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: theme.ink,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ti.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>
                      {(ti.icon || '').replace(/^Icon/, '')}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditor(ti)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: theme.accent,
                      padding: 0,
                    }}
                  >
                    Edit
                    <IconChevronRight size={11} />
                  </button>
                  <button
                    onClick={() => removeIcon(ti.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink3, display: 'inline-flex', padding: 4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#E24B4A')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = theme.ink3)}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}

              {icons.length === 0 && (
                <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                  Nessuna icona di tipo definita
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor sub-dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent showCloseButton={false} style={{ ...dialogStyle, maxWidth: 384 }}>
          <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
            <h2
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: 0,
              }}
            >
              {editingIcon ? 'Modifica icona' : 'Nuova icona'}
            </h2>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
              {editingIcon ? 'Modifica nome, icona e colore.' : 'Crea una nuova icona di tipo personalizzata.'}
            </p>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: color || theme.surface,
                  border: `2px solid ${theme.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                }}
              >
                {icon ? <RenderIcon name={icon} size={32} color={readableOn(color || theme.surface)} /> : <span style={{ color: theme.ink3, fontSize: 24 }}>?</span>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. In lavorazione"
                style={{
                  width: '100%',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  padding: '8px 10px',
                  color: theme.ink,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={labelStyle}>Icona</label>
              <IconPicker
                value={icon}
                onChange={setIcon}
                trigger={
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: theme.surfaceVariant,
                      border: `2px solid ${theme.border}`,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    {icon ? (
                      <>
                        <RenderIcon name={icon} size={16} color={theme.ink} />
                        <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink }}>
                          {icon.replace(/^Icon/, '')}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3 }}>Scegli icona...</span>
                    )}
                  </div>
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Colore sfondo</label>
              <ColorPickerGrid
                selectedColor={color || null}
                onSelect={(hex) => setColor(hex || '')}
                showReset
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: 12,
              borderTop: `2px solid ${theme.border}`,
              background: theme.surfaceVariant,
            }}
          >
            <button
              onClick={() => setEditorOpen(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 12px',
                height: 28,
                background: theme.surface,
                color: theme.ink2,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !icon}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 12px',
                height: 28,
                background: theme.accent,
                color: theme.onAccent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: (!name.trim() || !icon) ? 'not-allowed' : 'pointer',
                opacity: (!name.trim() || !icon) ? 0.5 : 1,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              {editingIcon ? 'Salva' : 'Crea'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
