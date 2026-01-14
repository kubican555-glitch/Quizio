import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const UserManagement = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ class: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkClass, setBulkClass] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    try {
      setLoading(true);
      setErrorMessage('');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error.message);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (profile) => {
    setEditingId(profile.id);
    setEditValues({
      class: profile.class || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(profiles.map((profile) => profile.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id, checked) => {
    setSelectedIds((prev) => {
      if (checked) return [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  async function applyBulkClass() {
    if (selectedIds.length === 0) return;
    try {
      setBulkLoading(true);
      const nextClass = bulkClass.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ class: nextClass || null })
        .in('id', selectedIds);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id) ? { ...p, class: nextClass || null } : p
        )
      );
    } catch (error) {
      alert('Chyba při hromadné aktualizaci: ' + error.message);
    } finally {
      setBulkLoading(false);
    }
  }

  async function updateProfile(id) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          class: editValues.class
        })
        .eq('id', id);

      if (error) throw error;

      setProfiles(profiles.map(p =>
        p.id === id ? { ...p, class: editValues.class } : p
      ));
      setEditingId(null);
    } catch (error) {
      alert('Chyba při aktualizaci: ' + error.message);
    }
  }

  if (loading) return <div className="admin-loading">Načítání uživatelů...</div>;

  return (
    <div className="user-management">
      {errorMessage && (
        <div style={{ marginBottom: '1rem', color: '#ef4444', fontWeight: 600 }}>
          Chyba načtení uživatelů: {errorMessage}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="admin-input"
          value={bulkClass}
          onChange={(e) => setBulkClass(e.target.value)}
          placeholder="Třída pro vybrané (např. 4.B)"
          style={{ minWidth: '220px' }}
        />
        <button
          className="save-btn"
          onClick={applyBulkClass}
          disabled={bulkLoading || selectedIds.length === 0}
        >
          {bulkLoading ? 'Ukládám...' : `Uložit třídu (${selectedIds.length})`}
        </button>
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={profiles.length > 0 && selectedIds.length === profiles.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              <th>Jméno</th>
              <th>Třída</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', opacity: 0.7 }}>
                  Žádné záznamy.
                </td>
              </tr>
            ) : profiles.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(profile.id)}
                    onChange={(e) => toggleSelectOne(profile.id, e.target.checked)}
                  />
                </td>
                <td>{profile.full_name || profile.username || profile.email || profile.id}</td>
                <td>
                  {editingId === profile.id ? (
                    <input
                      type="text"
                      className="admin-input"
                      value={editValues.class}
                      onChange={(e) => setEditValues({ ...editValues, class: e.target.value })}
                      placeholder="např. 4.B"
                    />
                  ) : (
                    <span className="class-badge">{profile.class || '-'}</span>
                  )}
                </td>
                <td>
                  {editingId === profile.id ? (
                    <div className="admin-actions">
                      <button className="save-btn" onClick={() => updateProfile(profile.id)}>Uložit</button>
                      <button className="cancel-btn" onClick={cancelEdit}>Zrušit</button>
                    </div>
                  ) : (
                    <button className="edit-btn" onClick={() => startEdit(profile)}>Upravit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
