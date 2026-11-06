import assert from 'node:assert/strict';
import {services as original, packages as originalPackages} from './businessCatalog.ts';
import {serviceById,archivedById,packages} from './catalog.ts';
for(const item of original){const target=serviceById(item.id);if(item.status==='archived'){assert.equal(target,undefined);assert.ok(archivedById(item.id));continue;}assert.ok(target);for(const key of ['name','priceUsd','billing','startingFrom','summary','deliverables','scopeLimits','exclusions','customerInputs','deliveryEstimate','revisions'])assert.deepEqual(target[key as keyof typeof target],item[key as keyof typeof item],item.id+' '+key);}
for(const item of originalPackages){const target=packages.find(p=>p.id===item.id)!;for(const key of ['priceUsd','name','included','excluded','serviceIds','billing'])assert.deepEqual(target[key as keyof typeof target],item[key as keyof typeof item]);}
console.log('PASS imported business services and package preserve exact terms; archived services stay unavailable');
