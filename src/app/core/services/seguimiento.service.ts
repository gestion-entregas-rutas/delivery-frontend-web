import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { LOGISTICA_SERVER_URL } from './logistica-api.service';
import { AuthService } from '../auth/auth.service';
import type { HubConnection } from '@microsoft/signalr';
@Injectable({ providedIn: 'root' })
export class SeguimientoService implements OnDestroy {
  readonly live = signal(false);
  private readonly auth = inject(AuthService);
  private generation = 0;
  private readonly server = inject(LOGISTICA_SERVER_URL);
  private hub?: HubConnection;
  private fecha = '';
  private subscribedDate = '';
  private destroyed = false;
  async start(fecha: string, refresh: () => Promise<void>) {
    this.fecha = fecha;
    const generation = ++this.generation;
    if (
      !this.auth.token() ||
      this.auth.usuario()?.rol !== 'Administrador' ||
      this.auth.usuario()?.debeCambiarCredenciales
    )
      return;
    try {
      const { HubConnectionBuilder } = await import('@microsoft/signalr');
      if (this.destroyed || generation !== this.generation) return;
      const hub = new HubConnectionBuilder()
        .withUrl(this.server + '/hubs/seguimiento', {
          accessTokenFactory: () => this.auth.token() || '',
        })
        .withAutomaticReconnect()
        .build();
      hub.on('PedidoActualizado', () => {
        if (generation === this.generation) void refresh();
      });
      hub.on('RutaActualizada', () => {
        if (generation === this.generation) void refresh();
      });
      hub.onreconnecting(() => {
        if (generation === this.generation) this.live.set(false);
      });
      hub.onclose(() => {
        if (generation === this.generation) this.live.set(false);
      });
      hub.onreconnected(async () => {
        if (generation !== this.generation) return;
        this.subscribedDate = '';
        await this.subscribeDate(this.fecha);
        await refresh();
      });
      this.hub = hub;
      await hub.start();
      if (generation !== this.generation) {
        await hub.stop();
        return;
      }
      await this.subscribeDate(this.fecha);
      await refresh();
    } catch {
      if (generation === this.generation) this.live.set(false);
    }
  }
  async subscribeDate(fecha: string) {
    this.fecha = fecha;
    const hub = this.hub;
    const generation = this.generation;
    if (hub?.state !== 'Connected') return;
    try {
      if (this.subscribedDate) await hub.invoke('CancelarFecha', this.subscribedDate);
      if (generation !== this.generation) return;
      await hub.invoke('SuscribirseAFecha', fecha);
      if (generation !== this.generation) return;
      this.subscribedDate = fecha;
      this.live.set(true);
    } catch {
      if (generation === this.generation) this.live.set(false);
    }
  }
  async stop() {
    this.generation++;
    const hub = this.hub;
    this.hub = undefined;
    this.subscribedDate = '';
    this.live.set(false);
    await hub?.stop();
  }
  async restart(fecha: string, refresh: () => Promise<void>) {
    await this.stop();
    await this.start(fecha, refresh);
  }
  ngOnDestroy() {
    this.destroyed = true;
    void this.stop();
  }
}
