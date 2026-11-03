import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { searchMedia, toSearchSummary } from '../../api/media';
import { useLocale } from '../../providers/LocaleProvider';
export type SearchFilter='all'|'movie'|'tv';
export function useMediaSearch(){const {locale}=useLocale();const [text,setText]=useState('');const [filter,setFilter]=useState<SearchFilter>('all');const [query,setQuery]=useState('');const trimmed=text.trim();useEffect(()=>{const timer=setTimeout(()=>setQuery(trimmed),250);return()=>clearTimeout(timer)},[trimmed]);const ready=query.length>=2;const q=useQuery({queryKey:['search',query,locale],queryFn:({signal})=>searchMedia(query,1,locale,signal),enabled:ready});const items=ready?(q.data?.results??[]).map(toSearchSummary).filter(i=>filter==='all'||i.mediaType===filter):[];return {text,setText,filter,setFilter,ready,q,items}}
