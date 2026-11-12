import { Component, EventEmitter, OnDestroy, Output, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AddressSearchService } from '../../../core/services/address-search.service';
import { AddressResult } from '../../../core/models/address-result.model';
import { PuntoDto } from '../../../core/models/logistica.models';

@Component({
  selector: 'app-map-search',
  imports: [FormsModule],
  template: `
    <div class="flex items-center gap-space-sm my-space-sm">
      <input
        class="w-full px-space-md py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface border border-separator-hairline-light focus:ring-2 focus:ring-primary/20 focus:outline-none"
        aria-label="Buscar lugar o dirección en OpenStreetMap"
        placeholder="Buscar dirección, sector o ciudad…"
        [(ngModel)]="query"
        [disabled]="disabled"
        maxlength="150"
        (ngModelChange)="resetSearch()"
        [ngModelOptions]="{ standalone: true }"
        (keydown.enter)="$event.preventDefault(); search()"
      />
      <button
        type="button"
        class="button"
        [disabled]="disabled || busy() || query.trim().length < 3"
        (click)="search()"
      >
        {{ busy() ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>
    @for (result of results(); track $index) {
      <button
        type="button"
        class="button w-full my-space-2xs"
        [disabled]="disabled"
        (click)="choose(result)"
      >
        {{ result.label }}
      </button>
    }
    @if (message()) {
      <p class="font-caption text-caption text-outline" role="status">{{ message() }}</p>
    }
  `,
})
export class MapSearch implements OnDestroy {
  private readonly service = inject(AddressSearchService);
  @Output() pointSelected = new EventEmitter<PuntoDto>();
  @Output() placeSelected = new EventEmitter<AddressResult>();
  @Output() searchReset = new EventEmitter<void>();
  @Input() disabled = false;
  query = '';
  readonly busy = signal(false);
  readonly results = signal<AddressResult[]>([]);
  readonly message = signal('');
  private request?: Subscription;
  resetSearch() {
    this.request?.unsubscribe();
    this.busy.set(false);
    this.results.set([]);
    this.message.set('');
    this.searchReset.emit();
  }
  search() {
    if (this.disabled || this.busy() || this.query.trim().length < 3) return;
    this.searchReset.emit();
    this.busy.set(true);
    this.message.set('');
    this.results.set([]);
    this.request = this.service.search(this.query).subscribe({
      next: (results) => {
        this.busy.set(false);
        this.results.set(results);
        if (!results.length)
          this.message.set(
            'No se encontraron coincidencias. Puedes navegar directamente en el mapa.',
          );
      },
      error: () => {
        this.busy.set(false);
        this.message.set('No se pudo buscar. Puedes navegar directamente en el mapa.');
      },
    });
  }
  choose(result: AddressResult) {
    if (this.disabled) return;
    this.pointSelected.emit({ latitud: result.latitud, longitud: result.longitud });
    this.results.set([]);
    this.placeSelected.emit(result);
    this.message.set('Lugar seleccionado. Revisa su contorno o dibuja la cobertura manualmente.');
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
}
