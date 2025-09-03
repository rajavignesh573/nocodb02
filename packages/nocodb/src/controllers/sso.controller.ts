import { Controller, Get, Query, UseGuards, Request, Response } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { genJwt } from '~/services/users/helpers';
import { NcError } from '~/helpers/catchError';
import { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';

@Controller()
@UseGuards(GlobalGuard)
export class SsoController {
  constructor(private readonly metaService: MetaService) {}

  /**
   * Generate JWT token for iframe SSO integration
   * This endpoint creates a simple JWT token that can be used by external applications
   * like the Vercel AI chatbot for authentication
   */
  @Get('/api/v1/sso/jwt-token')
  async generateJwtToken(@Request() req, @Response() res, @Query() query) {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        throw NcError.unauthorized('User not authenticated');
      }

      // Get NocoDB configuration for JWT
      const config = Noco.getConfig();
      
      // Create a simple user object from the request
      const user = {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
        roles: req.user.roles || {},
        token_version: req.user.token_version || 1,
        email_verified: req.user.email_verified || true
      };
      
      // Generate JWT token with user information
      const token = genJwt(user, config);
      
      // Create response with token and user info
      const response = {
        success: true,
        token: token,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          roles: user.roles
        },
        expiresIn: config.auth.jwt.options?.expiresIn || '10h',
        timestamp: new Date().toISOString()
      };

      // Return as JSON
      res.json(response);

    } catch (error) {
      console.error('SSO JWT generation error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate JWT token',
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Validate JWT token (for external applications to verify tokens)
   */
  @Get('/api/v1/sso/validate-token')
  async validateToken(@Request() req, @Response() res, @Query() query) {
    try {
      const { token } = query;
      
      if (!token) {
        throw NcError.badRequest('Token is required');
      }

      // Get NocoDB configuration for JWT
      const config = Noco.getConfig();
      
      // Verify the token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, config.auth.jwt.secret);
      
      res.json({
        success: true,
        valid: true,
        user: {
          id: decoded.id,
          email: decoded.email,
          roles: decoded.roles
        },
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      });

    } catch (error) {
      console.error('SSO JWT validation error:', error);
      
      res.status(401).json({
        success: false,
        valid: false,
        error: 'Invalid or expired token',
        message: error.message || 'Token validation failed'
      });
    }
  }

  /**
   * Get JWT secret for external applications
   */
  @Get('/api/v1/sso/jwt-secret')
  async getJwtSecret(@Request() req, @Response() res, @Query() query) {
    try {
      // Check if user is authenticated and has admin role
      if (!req.user || !req.user.id) {
        throw NcError.unauthorized('User not authenticated');
      }

      // Get NocoDB configuration for JWT
      const config = Noco.getConfig();
      
      res.json({
        success: true,
        secret: config.auth.jwt.secret,
        expiresIn: config.auth.jwt.options?.expiresIn || '10h',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('SSO JWT secret retrieval error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve JWT secret',
        message: error.message || 'Internal server error'
      });
    }
  }
}
