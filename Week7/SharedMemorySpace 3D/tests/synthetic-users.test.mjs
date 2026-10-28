import assert from 'node:assert/strict';
import {aiTestRoomKeys} from '../synthetic-users.js';
const users={real:{profile:{name:'Real'}},demo:{profile:{synthetic:true,source:'hand-authored demo'}},ai:{profile:{synthetic:true,source:'AI-generated test user'}},unmarked:{profile:{source:'AI-generated test user'}},mine:{profile:{synthetic:true,source:'AI-generated test user'}}};
assert.deepEqual(aiTestRoomKeys(users,'mine'),['ai']);assert.deepEqual(aiTestRoomKeys({}),[]);
console.log('PASS delete eligibility: only explicit AI test users; real users, demos and current identity protected');
