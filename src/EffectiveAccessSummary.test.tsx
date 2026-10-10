// @vitest-environment jsdom
import {afterEach,describe,it,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import EffectiveAccessSummary from './EffectiveAccessSummary'
import type {Profile,AccessControl} from './types/models'
afterEach(cleanup)
const profile={id:'member',tenant_owner_id:'owner',active:true,role:'ADMIN',roles:['ADMIN']} as Profile
const access={allowed_modules:['Clients'],denied_permissions:['clients.delete']} as AccessControl
const groups=[{module:'Clients',actions:[['clients.view','Voir'],['clients.delete','Supprimer']]}] as const
describe('effective access summary',()=>{
 it('shows a denied action even for an administrator',()=>{render(<EffectiveAccessSummary profile={profile} access={access} groups={groups} dirty={true}/>);expect(screen.getByText('Action interdite')).toBeTruthy();expect(screen.getByText(/Modifications non enregistrées/)).toBeTruthy();expect(screen.getByText('Bloqué')).toBeTruthy()})
 it('blocks all actions when the module is hidden',()=>{render(<EffectiveAccessSummary profile={profile} access={{...access,allowed_modules:[]}} groups={groups} dirty={false}/>);expect(screen.getAllByText('Bloqué')).toHaveLength(2)})
 it('explains the actual owner exception',()=>{render(<EffectiveAccessSummary profile={{...profile,id:'owner'}} access={access} groups={groups} dirty={false}/>);expect(screen.getAllByText('Autorisé')).toHaveLength(2);expect(screen.getByText(/retirer une case ne limite pas/)).toBeTruthy()})
})
