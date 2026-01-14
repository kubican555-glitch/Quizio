import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const UserManagement = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ role: '', class: '' });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error.message);
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (profile) => {
    setEditingId(profile.id);
    setEditValues({ 
      role: profile.role || 'user', 
      class: profile.class || '' 
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  async function updateProfile(id) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: editValues.role,
          class: editValues.class 
        })
        .eq('id', id);

      if (error) throw error;

      setProfiles(profiles.map(p => 
        p.id === id ? { ...p, role: editValues.role, class: editValues.class } : p
      ));
      setEditingId(null);
    } catch (error) {
      alert('Chyba při aktualizaci: ' + error.message);
    }
  }

  if (loading) return <div className="admin-loading">Načítání uživatelů...</div>;

  return (
    <div className="user-management">
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Email</th>
              <th>Třída</th>
              <th>Role</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.full_name}</td>
                <td className="email-cell">{profile.email}</td>
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
                    <select 
                      className="admin-select"
                      value={editValues.role}
                      onChange={(e) => setEditValues({ ...editValues, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`role-badge ${profile.role}`}>
                      {profile.role}
                    </span>
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
