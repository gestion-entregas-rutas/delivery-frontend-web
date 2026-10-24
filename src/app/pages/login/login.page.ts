import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorAutenticacion } from '../../core/models/autenticacion.models';
@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.page.html',
  styleUrl: '../../shared/auth-page.css',
})
export class LoginPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly visible = signal(false);
  nombreUsuario = '';
  clave = '';
  async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login({ nombreUsuario: this.nombreUsuario.trim(), clave: this.clave });
      this.clave = '';
      const target = this.route.snapshot.queryParamMap.get('returnUrl') || '/resumen';
      await this.router.navigateByUrl(
        this.auth.usuario()?.debeCambiarCredenciales
          ? '/credenciales'
          : /^\/(resumen|pedidos|repartidores|rutas|zonas|usuarios)([/?#]|$)/.test(target)
            ? target
            : '/resumen',
      );
    } catch (e) {
      this.error.set(errorAutenticacion(e, true));
    } finally {
      this.clave = '';
      this.busy.set(false);
    }
  }
}
