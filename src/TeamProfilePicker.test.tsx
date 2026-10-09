// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import TeamProfilePicker from './TeamProfilePicker'
import type {Profile} from './types/models'
afterEach(cleanup)
const profiles=[{id:'a',full_name:'Adama',role:'ADMIN',roles:['ADMIN'],active:true},{id:'b',full_name:'Traoré Seydou',role:'SUPER_ADMIN',active:true},{id:'c',full_name:'Client',role:'CLIENT',active:true},{id:'d',full_name:'Suspendu',role:'ADMIN',active:false}] as Profile[]
it('shows active collaborators with searchable names, not clients or suspended accounts',()=>{
 render(<TeamProfilePicker profiles={profiles} name="members"/>);expect(screen.queryByRole('button',{name:/Client/})).toBeNull();expect(screen.queryByRole('button',{name:/Suspendu/})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'traore'}});expect(screen.getByRole('button',{name:/Traoré Seydou/})).toBeTruthy();expect(screen.queryByRole('button',{name:/Adama/})).toBeNull();
})
it('preserves selection order and submits selections even when hidden by search',()=>{
 const {container}=render(<form><TeamProfilePicker profiles={profiles} name="members"/></form>);
 fireEvent.click(screen.getByRole('button',{name:/Traoré Seydou/}));fireEvent.click(screen.getByRole('button',{name:/Adama/}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'none'}});
 expect(new FormData(container.querySelector('form')!).getAll('members')).toEqual(['b','a']);fireEvent.click(screen.getByRole('button',{name:'Retirer Traoré Seydou'}));expect(new FormData(container.querySelector('form')!).getAll('members')).toEqual(['a']);
})
