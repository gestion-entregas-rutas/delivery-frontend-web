import { Component, inject, afterNextRender, OnDestroy, signal, HostListener } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { errorAutenticacion } from '../../core/models/autenticacion.models';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../core/services/operations.service';
import { OperationFormsService } from '../../core/services/operation-forms.service';
import { RouterOutlet } from '@angular/router';
import { OperationForm } from '../../shared/components/operation-form/operation-form';
import { PedidoDetail } from '../../shared/components/pedido-detail/pedido-detail';
import { PedidoDetailService } from '../../core/services/pedido-detail.service';
import { RouteAssignmentService } from '../../core/services/route-assignment.service';
import { RouteAssignment } from '../../shared/components/route-assignment/route-assignment';
import { CommonModule } from '@angular/common';
import { RouteOrder } from '../../shared/components/route-order/route-order';
import { RouteOrderService } from '../../core/services/route-order.service';
@Component({
  selector: 'app-admin-layout',
  imports: [CommonModule, FormsModule, RouterOutlet, OperationForm, RouteAssignment, PedidoDetail, RouteOrder],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly loggingOut = signal(false);
  readonly desktop = signal(true);
  private readonly assignment = inject(RouteAssignmentService);
  private readonly detail = inject(PedidoDetailService);
  private readonly routeOrder = inject(RouteOrderService);
  @HostListener('window:resize') updateViewport() {
    this.desktop.set(window.innerWidth > 900);
  }
  readonly navigationOpen = signal(false);
  readonly groups = ['Principal', 'Operaciones', 'Administración'];
  moduleSearch = '';
  matchesModule(name: string) {
    const item = this.operations.navigation.find((n) => n.name === name);
    return (
      !this.moduleSearch ||
      (item?.label + ' ' + name).toLocaleLowerCase().includes(this.moduleSearch.toLocaleLowerCase())
    );
  }
  visibleNavigation(group?: string) {
    const q = this.moduleSearch.toLocaleLowerCase().trim();
    return this.operations.navigation.filter(
      (n) =>
        (!group || n.group === group) &&
        (!q || (n.label + ' ' + n.name).toLocaleLowerCase().includes(q)),
    );
  }
  navigate(name: string) {
    this.navigationOpen.set(false);
    this.operations.navigate(name);
  }
  pageTitle() {
    return (
      this.operations.navigation.find((n) => n.name === this.operations.view())?.label ||
      this.operations.view()
    );
  }
  pageDescription() {
    return (
      (
        {
          Resumen: 'Tu operación en una mirada: pedidos, equipo y recorridos de entrega.',
          Pedidos: 'Registra entregas y consulta el estado de cada pedido.',
          Rutas: 'Genera rutas y administra sus paradas con las capacidades de tu operación.',
          Zonas: 'Dibuja y ajusta las áreas de cobertura en el mapa.',
          Repartidores: 'Gestiona la capacidad y disponibilidad de tu equipo.',
          Usuarios: 'Administra las cuentas, los permisos y las credenciales del equipo.',
          Productos: 'Administra el catálogo, precios, stock y disponibilidad de productos.',
          RetirosTienda: 'Consulta y confirma retiros en tienda para órdenes pagadas.',
        } as Record<string, string>
      )[this.operations.view()] || ''
    );
  }
  readonly operations = inject(OperationsService);
  readonly forms = inject(OperationFormsService);

  constructor() {
    afterNextRender(() => {
      this.updateViewport();
      this.operations.start();
    });
  }

  openPrimaryAction() {
    if (this.operations.view() === 'Repartidores') {
      this.forms.open('Repartidor');
    } else if (this.operations.view() === 'Zonas') {
      this.forms.open('Zona');
    } else if (this.operations.view() === 'Productos') {
      this.operations.navigate('Productos');
    } else if (this.operations.view() === 'RetirosTienda') {
      this.operations.navigate('RetirosTienda');
    }
  }

  async logout() {
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
    } catch (e) {
      this.operations.error.set(errorAutenticacion(e));
    } finally {
      this.loggingOut.set(false);
    }
  }

  changeCredentials() {
    this.operations.navigate('Credenciales');
  }

  ngOnDestroy() {
    this.routeOrder.reset();
    this.assignment.reset();
    this.detail.close();
    this.operations.stop();
    this.forms.modal.set('');
    this.forms.form = {};
    this.forms.zonePoints = [];
  }
}
