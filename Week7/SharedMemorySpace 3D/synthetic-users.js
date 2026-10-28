// Only explicitly AI-generated profiles qualify; manual demos are preserved.
export function aiTestRoomKeys(users,exclude=''){
 return Object.entries(users||{}).filter(([key,user])=>key!==exclude&&user?.profile?.synthetic===true&&user.profile.source==='AI-generated test user').map(([key])=>key);
}
